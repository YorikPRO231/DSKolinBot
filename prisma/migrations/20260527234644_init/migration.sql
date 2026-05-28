-- CreateTable
CREATE TABLE "public"."admins" (
    "discord_id" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "security" TEXT DEFAULT 'no',

    CONSTRAINT "admins_pkey" PRIMARY KEY ("discord_id")
);

-- CreateTable
CREATE TABLE "public"."inspection_reports" (
    "id" SERIAL NOT NULL,
    "passport" TEXT NOT NULL,
    "discord_id" TEXT,
    "result" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "admin_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."state_patches" (
    "id" SERIAL NOT NULL,
    "passport" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "discord_id" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "patch" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "history" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "state_patches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."infiltrations" (
    "id" SERIAL NOT NULL,
    "rank" INTEGER NOT NULL,
    "faction" TEXT NOT NULL,
    "detectivefaction" TEXT NOT NULL,
    "detectiveid" TEXT NOT NULL,
    "newnickname" TEXT NOT NULL,
    "oldnickname" TEXT NOT NULL,
    "passport" TEXT NOT NULL,

    CONSTRAINT "infiltrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "role_id" TEXT NOT NULL,
    "role_name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "permission_key" TEXT NOT NULL,
    "permission_name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("permission_key")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_key" TEXT NOT NULL,
    "granted_by" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateTable
CREATE TABLE "public"."user_permissions" (
    "user_id" TEXT NOT NULL,
    "permission_key" TEXT NOT NULL,
    "is_granted" BOOLEAN NOT NULL DEFAULT true,
    "granted_by" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("user_id","permission_key")
);

-- CreateTable
CREATE TABLE "public"."user_permissions_cache" (
    "user_id" TEXT NOT NULL,
    "permissions" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_cache_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_by" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "public"."transfers" (
    "id" SERIAL NOT NULL,
    "current_rank" INTEGER NOT NULL,
    "current" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "passport" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "current_approve" TEXT NOT NULL,
    "destination_approve" TEXT NOT NULL,
    "msg_id" TEXT NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bot_cheat_reports" (
    "id" SERIAL NOT NULL,
    "passport" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "author_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_cheat_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."security_logs" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "suspected_action" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "admin_id" TEXT NOT NULL,
    "check_results" TEXT NOT NULL,

    CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."warehouse_drain" (
    "id" SERIAL NOT NULL,
    "pasport" TEXT NOT NULL,
    "adm_id" TEXT NOT NULL,
    "punishment" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "log_file" BYTEA NOT NULL,
    "duration" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_drain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."warehouse_drain_v2" (
    "id" SERIAL NOT NULL,
    "passport" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "punishment" TEXT NOT NULL,
    "report_data" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_drain_v2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inspection_reports_passport_idx" ON "public"."inspection_reports"("passport");

-- CreateIndex
CREATE INDEX "inspection_reports_created_at_idx" ON "public"."inspection_reports"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "state_patches_passport_key" ON "public"."state_patches"("passport");

-- CreateIndex
CREATE UNIQUE INDEX "infiltrations_detectiveid_key" ON "public"."infiltrations"("detectiveid");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "public"."user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "public"."user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_passport_key" ON "public"."transfers"("passport");

-- CreateIndex
CREATE INDEX "warehouse_drain_pasport_idx" ON "public"."warehouse_drain"("pasport");

-- CreateIndex
CREATE INDEX "warehouse_drain_created_at_idx" ON "public"."warehouse_drain"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "public"."inspection_reports" ADD CONSTRAINT "inspection_reports_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("discord_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("permission_key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("permission_key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bot_cheat_reports" ADD CONSTRAINT "bot_cheat_reports_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."admins"("discord_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."warehouse_drain" ADD CONSTRAINT "warehouse_drain_adm_id_fkey" FOREIGN KEY ("adm_id") REFERENCES "public"."admins"("discord_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."warehouse_drain_v2" ADD CONSTRAINT "warehouse_drain_v2_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."admins"("discord_id") ON DELETE RESTRICT ON UPDATE CASCADE;
