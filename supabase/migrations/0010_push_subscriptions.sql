-- ══════════════════════════════════════════════════════════════════
-- NOTIFICATIONS IPHONE — les abonnements Web Push
-- ══════════════════════════════════════════════════════════════════
--
-- Quand l'élève active les notifications (Réglages, sur l'app installée),
-- le navigateur donne une ADRESSE d'envoi (`endpoint`) et deux clés de
-- chiffrement. On les range ici, une ligne par appareil.
--
-- Le serveur (app/api/push/cron/route.ts, clé secrète) lit ces lignes,
-- calcule les alertes de chaque élève (lib/alerts.ts) et envoie. `sent`
-- garde ce qui a déjà été envoyé dans la journée : jamais deux fois la
-- même notification.
--
-- RLS : un élève ne voit, ne crée, ne modifie et ne supprime QUE ses
-- abonnements. Additive : aucune autre table n'est touchée.

create table if not exists public.push_subscriptions (
  endpoint   text        primary key,
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh     text        not null,
  auth       text        not null,
  user_agent text,
  created_at timestamptz not null default now(),
  sent       jsonb       not null default '{}'::jsonb,
  constraint push_subscriptions_endpoint_https check (endpoint like 'https://%')
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions: lecture par le propriétaire" on public.push_subscriptions;
drop policy if exists "push_subscriptions: création par le propriétaire" on public.push_subscriptions;
drop policy if exists "push_subscriptions: modification par le propriétaire" on public.push_subscriptions;
drop policy if exists "push_subscriptions: suppression par le propriétaire" on public.push_subscriptions;

create policy "push_subscriptions: lecture par le propriétaire"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "push_subscriptions: création par le propriétaire"
  on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "push_subscriptions: modification par le propriétaire"
  on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "push_subscriptions: suppression par le propriétaire"
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
