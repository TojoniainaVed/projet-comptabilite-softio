<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AuditLogController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('audit.view');

        $user = $request->user();
        $query = AuditLog::query()
            ->with('user:id,name')
            // Un administrateur d'entreprise ne voit que les traces de son entreprise.
            ->when(! $user->isPlatformAdmin(), fn ($q) => $q->where('company_id', $user->company_id))
            ->when($request->filled('action'), fn ($q) => $q->where('action', 'like', $this->like($request->string('action')->value())))
            ->when($request->filled('user_id'), fn ($q) => $q->where('user_id', $request->integer('user_id')))
            ->when($request->filled('from'), fn ($q) => $q->whereDate('created_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('created_at', '<=', $request->date('to')))
            ->orderByDesc('id');

        return $this->listResponse($request, $query, AuditLogResource::class);
    }
}
