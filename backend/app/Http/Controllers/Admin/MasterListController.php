<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Support\MasterList;
use App\Support\Nifty50;
use Illuminate\Http\Request;

class MasterListController extends Controller
{
    /** The full universe to pick from + the current master-list selection. */
    public function show(): array
    {
        return [
            'symbols' => MasterList::symbols(),
            'instruments' => Nifty50::enriched(),
            'groups' => Nifty50::GROUP_LABELS,
            'max' => MasterList::MAX,
        ];
    }

    public function update(Request $r): array
    {
        $data = $r->validate([
            'symbols' => 'present|array|max:50',
            'symbols.*' => 'string|max:30',
        ]);
        $symbols = MasterList::set($data['symbols'], $r->user()->name);
        AuditLog::record('master_list_update', $r->user()->id, ['count' => count($symbols), 'symbols' => $symbols]);

        return ['symbols' => $symbols, 'max' => MasterList::MAX];
    }
}
