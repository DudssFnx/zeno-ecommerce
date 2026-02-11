-- Migration: Add bling_webhook_endpoints table
create table if not exists bling_webhook_endpoints (
   id                 serial primary key,
   company_id         varchar,
   url                text not null,
   active             boolean default true,
   last_status_code   integer,
   last_response_body text,
   last_called_at     timestamp,
   created_at         timestamp default now(),
   updated_at         timestamp default now()
);

-- Add index on company_id for faster lookups
create index if not exists idx_bling_webhook_endpoints_company_id on
   bling_webhook_endpoints (
      company_id
   );