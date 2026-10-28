<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Services\Audit\AuditLogger;
use LogicException;

class AuditLogTest extends FeatureTestCase
{
    public function test_audit_entries_cannot_be_updated_or_deleted(): void
    {
        $log = app(AuditLogger::class)->log('test.event');

        try {
            $log->update(['action' => 'falsifié']);
            $this->fail('La modification aurait dû être refusée.');
        } catch (LogicException) {
            $this->assertSame('test.event', $log->fresh()->action);
        }

        $this->expectException(LogicException::class);
        $log->delete();
    }

    public function test_sensitive_keys_are_masked_recursively(): void
    {
        $log = app(AuditLogger::class)->log('test.event', null, ['password' => 'secret-123', 'nested' => ['token' => 'abc'], 'ok' => 'visible']);

        $this->assertSame('[masqué]', $log->metadata['password']);
        $this->assertSame('[masqué]', $log->metadata['nested']['token']);
        $this->assertSame('visible', $log->metadata['ok']);
    }

    public function test_company_admin_only_reads_their_company_trail(): void
    {
        $companyA = $this->makeCompany();
        $companyB = $this->makeCompany();
        AuditLog::create(['company_id' => $companyA->id, 'action' => 'a.event']);
        AuditLog::create(['company_id' => $companyB->id, 'action' => 'b.event']);

        $this->signIn('company-admin', $companyA);
        $actions = collect($this->getJson('/api/v1/admin/audit-logs')->assertOk()->json('data'))->pluck('action');
        $this->assertTrue($actions->contains('a.event'));
        $this->assertFalse($actions->contains('b.event'));

        $this->signIn('super-admin');
        $actions = collect($this->getJson('/api/v1/admin/audit-logs')->assertOk()->json('data'))->pluck('action');
        $this->assertTrue($actions->contains('a.event') && $actions->contains('b.event'));
    }

    public function test_ordinary_users_cannot_read_the_audit_trail(): void
    {
        $this->signIn('accountant');

        $this->getJson('/api/v1/admin/audit-logs')->assertForbidden();
    }

    public function test_there_is_no_endpoint_to_modify_the_trail(): void
    {
        $this->signIn('super-admin');
        $log = AuditLog::create(['action' => 'x']);

        $this->putJson("/api/v1/admin/audit-logs/{$log->id}", [])->assertNotFound();
        $this->deleteJson("/api/v1/admin/audit-logs/{$log->id}")->assertNotFound();
    }
}
