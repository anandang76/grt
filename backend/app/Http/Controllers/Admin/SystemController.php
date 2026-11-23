<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Support\Facades\DB;

/** Super Admin only: roles overview and activity log. */
class SystemController extends Controller
{
    public const PERMISSIONS = [
        'Access trading terminal' => ['user', 'admin', 'superadmin'],
        'View users list' => ['admin', 'superadmin'],
        'Approve or reject signups' => ['admin', 'superadmin'],
        'Activate or deactivate users' => ['admin', 'superadmin'],
        'Manage admins' => ['superadmin'],
        'Reset user passwords' => ['superadmin'],
        'Change user roles' => ['superadmin'],
        'View activity log' => ['superadmin'],
    ];

    public function roles(): array
    {
        $roles = DB::table('roles as r')
            ->leftJoin('users as u', 'u.role', '=', 'r.slug')
            ->selectRaw("r.slug, r.name, r.description, r.rank, COUNT(u.id) as total, COALESCE(SUM(u.status = 'active'), 0) as active")
            ->groupBy('r.slug', 'r.name', 'r.description', 'r.rank')
            ->orderByDesc('r.rank')->get();

        return ['roles' => $roles, 'permissions' => self::PERMISSIONS];
    }

    public function audit(): array
    {
        $page = AuditLog::with('actor', 'target')->latest('id')->paginate(50);
        return [
            'data' => collect($page->items())->map->toApi(),
            'meta' => ['total' => $page->total(), 'page' => $page->currentPage(), 'pages' => $page->lastPage()],
        ];
    }
}
