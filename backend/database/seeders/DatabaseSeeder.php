<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('roles')->upsert([
            ['slug' => 'superadmin', 'name' => 'Super Admin', 'rank' => 3, 'description' => 'Full control: all users and admins, roles, password resets, activity log'],
            ['slug' => 'admin', 'name' => 'Admin', 'rank' => 2, 'description' => 'Approve or reject signups, activate or deactivate users'],
            ['slug' => 'user', 'name' => 'User', 'rank' => 1, 'description' => 'Trading terminal access'],
        ], ['slug'], ['name', 'rank', 'description']);
    }
}
