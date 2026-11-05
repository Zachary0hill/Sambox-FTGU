-- Enum additions must commit before the policies/defaults that use them.
alter type public.user_role add value if not exists 'manager';
alter type public.perm_resource add value if not exists 'ideas';
alter type public.perm_resource add value if not exists 'clients';
alter type public.perm_resource add value if not exists 'brands';
