-- Migration: Unassign super_admin users from companies
-- Removes companyId from users with super_admin role to ensure super-admins are not tied to any company

update users
   set
   company_id = null
 where lower(role) = 'super_admin'
    or lower(role) = 'superadmin';