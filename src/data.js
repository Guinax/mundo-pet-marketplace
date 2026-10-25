import { createClient } from '@supabase/supabase-js';
import config from './config.json' with { type: 'json' };

export const db = createClient(config.url, config.key, {
  auth: { storageKey: 'mundopet.auth.fresh.v2', detectSessionInUrl: true, persistSession: true },
});
export const state = { user: null, profile: null, roles: [], pets: [], products: [], services: [], stores: [], orders: [], appointments: [] };
export async function result(query) { const { data, error } = await query; if (error) throw error; return data; }
export async function loadPublic() {
  [state.products, state.services, state.stores] = await Promise.all([
    result(db.from('mp_products').select('*').eq('active', true).order('created_at')),
    result(db.from('mp_services').select('*').eq('active', true).order('name')),
    result(db.from('mp_stores').select('*').order('name')),
  ]);
}
export async function loadUser() {
  if (!state.user) { state.profile=null; state.roles=[]; state.pets=[]; state.orders=[]; state.appointments=[]; return; }
  const uid=state.user.id;
  const [profile,roles,pets,orders,appointments] = await Promise.all([
    result(db.from('mp_profiles').select('*').eq('user_id',uid).maybeSingle()),
    result(db.from('mp_memberships').select('role').eq('user_id',uid)),
    result(db.from('mp_pets').select('*').eq('owner_id',uid).order('created_at')),
    result(db.from('mp_orders').select('*,mp_order_items(*)').eq('buyer_id',uid).order('created_at',{ascending:false}).limit(100)),
    result(db.from('mp_appointments').select('*,mp_services(name,provider_name),mp_pets(name)').eq('tutor_id',uid).order('starts_at',{ascending:false}).limit(100)),
  ]);
  state.profile=profile;state.roles=roles.map(r=>r.role);state.pets=pets;state.orders=orders;state.appointments=appointments;
  await Promise.all(state.pets.filter(p=>p.photo_path).map(async p=>{const {data,error}=await db.storage.from('mp-pets').createSignedUrl(p.photo_path,1800);if(!error)p.photo_url=data.signedUrl;}));
}
export const can = role => state.roles.includes(role) || state.roles.includes('admin');
export const money = cents => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(cents)||0)/100);
export const dateTime = date => new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(date));
export const statusText = status => ({pending:'Aguardando aceite',preparing:'Em preparação',ready:'Aguardando coleta',assigned:'Entregador a caminho da loja',delivering:'Em entrega',delivered:'Entregue',canceled:'Cancelado',confirmed:'Confirmado',completed:'Concluído',approved:'Aprovado',rejected:'Recusado'}[status]||status);
export function cart() { try { return normalizeCart(JSON.parse(localStorage.getItem('mundopet.cart.v1')||'[]')); } catch { return []; } }
export function normalizeCart(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(i=>i&&typeof i.product_id==='string'&&Number.isInteger(i.quantity)&&i.quantity>0).map(i=>({product_id:i.product_id,quantity:Math.min(99,i.quantity)})).slice(0,30);
}
export function saveCart(items) { localStorage.setItem('mundopet.cart.v1',JSON.stringify(normalizeCart(items))); localStorage.removeItem('mundopet.order-request'); }
export function orderRequestKey() { let id=localStorage.getItem('mundopet.order-request');if(!id){id=crypto.randomUUID();localStorage.setItem('mundopet.order-request',id);}return id; }
export function favorites() { try { const ids=JSON.parse(localStorage.getItem('mundopet.favorites.v1')||'[]');return Array.isArray(ids)?ids:[]; } catch { return []; } }
export function toggleFavorite(id) { const ids=favorites();localStorage.setItem('mundopet.favorites.v1',JSON.stringify(ids.includes(id)?ids.filter(i=>i!==id):[...ids,id])); }
export function validCPF(value) {
  const cpf=String(value).replace(/\D/g,'');
  if(!/^\d{11}$/.test(cpf)||/^(\d)\1+$/.test(cpf))return false;
  return [9,10].every(n=>{let sum=0;for(let i=0;i<n;i++)sum+=Number(cpf[i])*(n+1-i);const r=(sum*10)%11;return Number(cpf[n])===(r===10?0:r);});
}
export function cartTotal(items,products) { return items.reduce((sum,item)=>sum+(products.find(p=>p.id===item.product_id)?.price_cents||0)*item.quantity,0); }
export function formObject(form) { return Object.fromEntries(new FormData(form)); }
