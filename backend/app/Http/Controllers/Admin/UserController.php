<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\Notifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class UserController extends Controller
{
    public function stats(): array
    {
        $by = User::selectRaw('status, COUNT(*) c')->groupBy('status')->pluck('c', 'status');
        return [
            'counts' => [
                'total' => (int) $by->sum(),
                'pending' => (int) ($by['pending'] ?? 0),
                'active' => (int) ($by['active'] ?? 0),
                'inactive' => (int) (($by['inactive'] ?? 0) + ($by['rejected'] ?? 0)),
            ],
            'pending' => User::where('status', 'pending')->oldest()->limit(50)->get()->map->toAdmin(),
        ];
    }

    public function index(Request $r): array
    {
        $me = $r->user();
        $q = User::query()->with('approver');

        if ($s = trim((string) $r->query('q'))) {
            $like = '%'.addcslashes($s, '%_\\').'%';
            $q->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('phone', 'like', $like));
        }
        $status = $r->query('status');
        if ($status === 'inactive') {
            $q->whereIn('status', ['inactive', 'rejected']);
        } elseif (in_array($status, ['pending', 'active', 'rejected'], true)) {
            $q->where('status', $status);
        }
        if (isset(User::ROLE_RANK[$r->query('role')])) {
            $q->where('role', $r->query('role'));
        }

        $page = $q->orderByRaw("FIELD(status,'pending','active','inactive','rejected')")->latest()->paginate(25);

        return [
            'data' => collect($page->items())->map(fn (User $u) => $u->toAdmin() + ['can_manage' => $me->canManage($u)]),
            'meta' => ['total' => $page->total(), 'page' => $page->currentPage(), 'pages' => $page->lastPage()],
        ];
    }

    public function show(Request $r, User $user): array
    {
        return [
            'user' => $user->load('approver')->toAdmin(),
            'can_manage' => $r->user()->canManage($user),
            'activity' => AuditLog::with('actor', 'target')
                ->where(fn ($w) => $w->where('target_id', $user->id)->orWhere('actor_id', $user->id))
                ->latest('id')->limit(15)->get()->map->toApi(),
        ];
    }

    public function action(Request $r, User $user, Notifier $notify): JsonResponse
    {
        $me = $r->user();
        $data = $r->validate([
            'action' => 'required|in:approve,reject,activate,deactivate,reset_password,set_role',
            'role' => 'required_if:action,set_role|in:user,admin',
        ]);
        $action = $data['action'];

        if (! $me->canManage($user)) {
            return $this->fail('You cannot manage this user.', 403);
        }
        if (in_array($action, ['reset_password', 'set_role'], true) && ! $me->isSuper()) {
            return $this->fail('Only a Super Admin can do that.', 403);
        }

        $extra = [];
        switch ($action) {
            case 'approve':
            case 'reject':
                if ($user->status !== 'pending') {
                    return $this->fail('This user is not pending approval.');
                }
                $this->setStatus($user, $action === 'approve' ? 'active' : 'rejected', $me);
                $action === 'approve' ? $notify->approved($user) : $notify->rejected($user);
                $msg = $action === 'approve' ? "{$user->name} approved and notified by email." : "{$user->name} rejected.";
                break;

            case 'activate':
                if (! in_array($user->status, ['inactive', 'rejected'], true)) {
                    return $this->fail('Nothing to change.');
                }
                $this->setStatus($user, 'active', $me);
                $msg = "{$user->name} is now active.";
                break;

            case 'deactivate':
                if ($user->status !== 'active') {
                    return $this->fail('User is not active.');
                }
                $this->setStatus($user, 'inactive', $me);
                $msg = "{$user->name} has been deactivated.";
                break;

            case 'reset_password':
                do {
                    $temp = Str::password(10, symbols: false);
                } while (! preg_match('/[A-Za-z]/', $temp) || ! preg_match('/\d/', $temp));
                $user->forceFill(['password' => $temp, 'must_change_password' => true])->save();
                AuditLog::record('password_reset_admin', $user->id);
                $sent = $notify->tempPassword($user, $temp);
                $extra['temp_password'] = $temp;
                $msg = $sent ? "Temporary password emailed to {$user->email}." : 'Email failed. Share the temporary password securely.';
                break;

            case 'set_role':
                if ($data['role'] === $user->role) {
                    return $this->fail('Nothing to change.');
                }
                AuditLog::record('role_change', $user->id, ['from' => $user->role, 'to' => $data['role']]);
                $user->forceFill(['role' => $data['role']])->save();
                $msg = "{$user->name} is now ".User::ROLE_LABELS[$data['role']].'.';
                break;
        }

        return response()->json(['message' => $msg, 'user' => $user->fresh('approver')->toAdmin()] + $extra);
    }

    private function setStatus(User $user, string $status, User $me): void
    {
        $from = $user->status;
        $fill = ['status' => $status];
        if ($status === 'active' && ! $user->approved_at) {
            $fill += ['approved_by' => $me->id, 'approved_at' => now()];
        }
        $user->forceFill($fill)->save();
        AuditLog::record('status_'.$status, $user->id, ['from' => $from]);
    }

    private function fail(string $msg, int $code = 422): JsonResponse
    {
        return response()->json(['message' => $msg], $code);
    }
}
