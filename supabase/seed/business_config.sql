-- business_config.sql
-- REAL business configuration — unlike demo_data.sql, this is meant to
-- be run against your production Supabase project too. Update the
-- values below (or edit the `settings` row directly, e.g. via the
-- Supabase dashboard) as real business details are confirmed.

insert into settings (key, value_json) values
  (
    'contact_info',
    '{
      "whatsappNumber": "2349123100767",
      "email": null,
      "socialLinks": {}
    }'
  )
on conflict (key) do update set value_json = excluded.value_json, updated_at = now();
