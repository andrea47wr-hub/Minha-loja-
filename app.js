(()=>{'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='minhaLojaLocal_v1', AUTH='minhaLojaLocal_auth_v1';
const money=n=>(Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const today=()=>new Date().toLocaleDateString('en-CA');
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
let data={customers:[],products:[],sales:[],expenses:[],personal:[],personalCats:[]};
let page='inicio';
function load(){try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d&&typeof d==='object')data={...data,...d}}catch(e){}normalizeSales()}
function save(){localStorage.setItem(KEY,JSON.stringify(data));render()}
function showApp(){render();updateNotifUI();checkDue()}
function go(p){page=p;$$('.page').forEach(x=>x.classList.add('hidden'));$('#page-'+p).classList.remove('hidden');$$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===(p==='ficha'?'clientes':p)));render()}
$('#nav').addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(b)go(b.dataset.page)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-goto]');if(b)go(b.dataset.goto)});
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function customerName(id,s){return data.customers.find(x=>x.id===id)?.name||(s&&s.customerName)||'Cliente removido/sem nome'}
function productName(id,s){return data.products.find(x=>x.id===id)?.name||(s&&s.productName)||'Produto removido'}
const sum=(arr,fn)=>arr.reduce((n,x)=>n+fn(x),0);
const openAmount=s=>Math.max(0,(+s.total||0)-(+s.paid||0));
const salesOf=id=>data.sales.filter(s=>s.customer===id);
const fmtDate=d=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(d||'');return m?m[3]+'/'+m[2]+'/'+m[1]:(d||'')};
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const monthLabel=k=>/^\d{4}-\d{2}$/.test(k)?MESES[+k.slice(5)-1]+' de '+k.slice(0,4):'Sem data';
let currentCustomer=null;
function totals(){let received=data.sales.reduce((s,x)=>s+(+x.paid||0),0);let open=data.sales.reduce((s,x)=>s+Math.max(0,(+x.total||0)-(+x.paid||0)),0);let expenses=data.expenses.reduce((s,x)=>s+(+x.amount||0),0);return{received,open,expenses,balance:received-expenses}}
function render(){if($('#app').classList.contains('hidden'))return;
const prevC=$('#saleCustomer').value,prevP=$('#saleProduct').value;
$('#saleCustomer').innerHTML='<option value="">Venda sem cliente</option>'+data.customers.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${c.id}">${escapeHtml(c.name)}${custStats(c).heart?' ❤️':''}</option>`).join('');$('#saleCustomer').value=prevC;
const pq=normQ($('#saleProductSearch').value),plist=sortedProducts().filter(p=>!pq||normQ(p.name).includes(pq));
$('#saleProduct').innerHTML=plist.length?plist.map(p=>`<option value="${p.id}" data-price="${p.price}">${escapeHtml(p.name)} — ${money(p.price)}</option>`).join(''):'<option value="">Nenhum produto encontrado</option>';
if(prevP&&plist.some(p=>p.id===prevP))$('#saleProduct').value=prevP;
if(!$('#saleProduct').value&&plist.length)$('#saleProduct').value=plist[0].id;
if(page==='vendas'&&!$('#saleTotal').value)fillTotal();
$('#recentSales').innerHTML=salesMarkup(data.sales.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5));
$('#customersList').innerHTML=data.customers.length?(lastL='',sortedCustomers()).map(c=>{const hd=letterHdr(c);const ss=salesOf(c.id),op=sum(ss,openAmount);return hd+`<div class="item sale" data-q="${escapeHtml(c.name+' '+(c.phone||''))}"><div class="details link" data-ficha="${c.id}"><b>${nameHtml(c)}</b> <span class="pill">${ss.length} compra(s)</span>${op>0?' <span class="pill warn">deve '+money(op)+'</span>':''}<div class="muted">${escapeHtml(c.phone||'Sem telefone')} ${c.notes?' • '+escapeHtml(c.notes):''}</div></div><div class="row" style="flex:1 1 100%"><button class="small" data-ficha="${c.id}">Abrir ficha</button>${op>0?`<button class="small" data-cust-pay="${c.id}">Registrar pagamento</button>`:''}${c.phone?`<button class="secondary small" data-wa="${c.id}">WhatsApp</button>`:''}<button class="danger small" data-del-customer="${c.id}">Excluir</button></div></div>`}).join(''):'<div class="empty">Nenhum cliente cadastrado.</div>';
$('#productsList').innerHTML=data.products.length?(lastP='',data.products.slice().sort((x,y)=>x.name.localeCompare(y.name,'pt-BR',{sensitivity:'base'}))).map(p=>{const hd=letterHdrP(p);const low=p.minStock===undefined?2:+p.minStock;const st=p.stock===undefined?'<span class="pill">estoque não controlado</span>':(+p.stock<=0?'<span class="pill bad">sem estoque</span>':(+p.stock<=low?`<span class="pill warn">estoque baixo: ${p.stock} un.</span>`:`<span class="pill">estoque: ${p.stock} un.</span>`));return hd+`<div class="item sale" data-q="${escapeHtml(p.name)}"><div class="details"><b>${escapeHtml(p.name)}</b> ${st}<div>${money(p.price)} <span class="muted">• paguei ${money(p.cost)}</span></div></div><div class="row" style="flex:1 1 100%"><button class="secondary small" data-buy="${p.id}">Registrar compra</button><button class="secondary small" data-stock="${p.id}">Ajustar estoque</button><button class="danger small" data-del-product="${p.id}">Excluir</button></div></div>`}).join(''):'<div class="empty">Nenhum produto cadastrado.</div>';
$('#salesList').innerHTML=salesMarkup(data.sales.slice().sort((a,b)=>b.date.localeCompare(a.date)));
$('#expensesList').innerHTML=data.expenses.length?data.expenses.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<div class="item"><div class="details"><b>${escapeHtml(x.description)}</b> ${x.auto?'<span class="pill">automática</span>':''}<div class="muted">${escapeHtml(x.category)} • ${escapeHtml(fmtDate(x.date))}</div></div><div><b>${money(x.amount)}</b> <button class="danger small" data-del-expense="${x.id}">Excluir</button></div></div>`).join(''):'<div class="empty">Nenhuma despesa registrada.</div>';
renderPanel();renderFicha();updateSaleStockInfo();renderLegend();filterCustomers();filterProducts();renderPersonal();setDateMax();renderCartList();
}
function dueTag(s){const rs=saleReceipts(s).filter(r=>r.date);if(!rs.length)return '';const d=daysUntil(rs[0].date);return d<0?` <span class="pill bad">cobrança atrasada ${-d} dia(s)</span>`:d===0?' <span class="pill warn">cobrar hoje</span>':` <span class="pill">cobrar em ${escapeHtml(fmtDate(rs[0].date))}</span>`}
function salesMarkup(arr,noPay){return arr.length?arr.map(s=>{const known=s.customer&&data.customers.some(c=>c.id===s.customer);const who=s.customer||s.customerName?(known?`<span class="link" data-ficha="${escapeHtml(s.customer)}" style="text-decoration:underline">${whoHtml(s)}</span>`:escapeHtml(customerName(s.customer,s))):'Venda sem cliente';return `<div class="item sale"><div class="details"><b>${escapeHtml(saleTitle(s))}</b> — ${money(s.total)}${dueTag(s)}${itemsHtml(s)}<div class="muted">${escapeHtml(fmtDate(s.date))} • ${who}</div><div class="muted">Pago: ${money(s.paid)} • Falta: ${money(openAmount(s))}</div>${parcLine(s)}${s.notes?`<div class="muted">${escapeHtml(s.notes)}</div>`:''}</div><div class="row" style="flex:1 1 100%">${noPay?'':`<button class="secondary small" data-pay="${s.id}">Registrar pagamento</button>`}${openAmount(s)>0?`<button class="secondary small" data-edit-sale="${s.id}">Datas de cobrança</button>`:''}<button class="secondary small" data-edit-sale="${s.id}">Editar venda</button><button class="danger small" data-del-sale="${s.id}">Excluir</button></div></div>`}).join(''):'<div class="empty">Nenhuma venda registrada.</div>'}
$('#customerForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),name=f.get('name').trim();const dup=data.customers.find(c=>c.name.trim().toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'));if(dup){alert('Já existe um cliente com esse nome. Abrindo a ficha dele, onde ficam todas as compras.');e.target.reset();openFicha(dup.id);return}data.customers.push({id:uid(),name,phone:f.get('phone').trim(),notes:f.get('notes').trim()});e.target.reset();save();alert('Cliente salvo.')});
function addPurchase(p,qty,unit,date){p.stock=(+p.stock||0)+qty;data.expenses.push({id:uid(),description:'Compra: '+p.name+(qty>1?' ('+qty+' un.)':''),category:'Reposição',amount:+(unit*qty).toFixed(2),date:date||today(),productId:p.id,auto:true})}
$('#productForm').elements.date.value=today();
$('#productForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),cost=+f.get('cost')||0,qty=Math.max(1,Math.floor(+f.get('qty')||1));const p={id:uid(),name:f.get('name').trim(),price:+f.get('price'),cost,stock:0,minStock:Math.max(0,Math.floor(+f.get('min')||0))};data.products.push(p);if(cost>0)addPurchase(p,qty,cost,f.get('date'));else p.stock=qty;e.target.reset();$('#productForm').elements.date.value=today();save();alert('Produto salvo. Estoque: '+qty+' un.'+(cost>0?' Gasto de '+money(cost*qty)+' lançado em Despesas.':''))});
function fillTotal(){if(cart.length){$('#saleTotal').value=cartTotal().toFixed(2);return}const p=data.products.find(x=>x.id===$('#saleProduct').value);if(p)$('#saleTotal').value=(p.price*(+$('#saleForm').elements.qty.value||1)).toFixed(2)}
$('#saleProduct').addEventListener('change',()=>{fillTotal();updateSaleStockInfo()});
$('#saleForm').elements.qty.addEventListener('input',()=>{fillTotal();updateSaleStockInfo()});
$('#saleForm').elements.date.value=today();
$('#expenseForm').elements.date.value=today();
$('#expenseForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);data.expenses.push({id:uid(),description:f.get('description').trim(),category:f.get('category'),amount:+f.get('amount'),date:f.get('date')||today()});e.target.reset();$('#expenseForm').elements.date.value=today();save();alert('Despesa salva.')});
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
if(b.dataset.pay){const s=data.sales.find(x=>x.id===b.dataset.pay);if(!s)return;const remaining=Math.max(0,s.total-s.paid);if(!remaining){alert('Esta venda já está totalmente paga.');return}const v=prompt('Quanto recebeu agora? Falta '+money(remaining));if(v===null)return;const n=Number(v.replace(',','.'));if(!Number.isFinite(n)||n<=0||n>remaining){alert('Digite um valor maior que zero e até '+money(remaining));return}s.payments=Array.isArray(s.payments)?s.payments:(s.paid>0?[{date:s.date||today(),amount:+s.paid}]:[]);s.payments.push({date:today(),amount:n});s.paid=+(s.paid+n).toFixed(2);save()}
if(b.dataset.delCustomer){if(confirm('Excluir este cliente? As vendas antigas serão mantidas.')){data.customers=data.customers.filter(x=>x.id!==b.dataset.delCustomer);save()}}
if(b.dataset.delProduct){if(confirm('Excluir este produto? As vendas antigas serão mantidas.')){data.products=data.products.filter(x=>x.id!==b.dataset.delProduct);save()}}
if(b.dataset.delSale){if(confirm('Excluir esta venda? O valor recebido deixará de contar no caixa e o produto volta ao estoque.')){const s=data.sales.find(x=>x.id===b.dataset.delSale);if(s)itemsOf(s).forEach(it=>{const p=prodOf(it.product);if(p&&p.stock!==undefined&&it.stockUsed)p.stock=(+p.stock||0)+(+it.stockUsed||0)});data.sales=data.sales.filter(x=>x.id!==b.dataset.delSale);save()}}
if(b.dataset.delExpense){if(confirm('Excluir esta despesa?')){data.expenses=data.expenses.filter(x=>x.id!==b.dataset.delExpense);save()}}
});
$('#customerSearch').addEventListener('input',filterCustomers);
$('#runReport').addEventListener('click',()=>{const a=$('#reportFrom').value||'0000-01-01',b=$('#reportTo').value||'9999-12-31';const sales=data.sales.filter(s=>s.date>=a&&s.date<=b),ex=data.expenses.filter(x=>x.date>=a&&x.date<=b);const gross=sales.reduce((n,s)=>n+s.total,0),received=sales.reduce((n,s)=>n+s.paid,0),open=sales.reduce((n,s)=>n+Math.max(0,s.total-s.paid),0),costs=ex.reduce((n,x)=>n+x.amount,0);const byCustomer={};sales.forEach(s=>{if(s.customer)byCustomer[s.customer]=(byCustomer[s.customer]||0)+s.total});const byProduct={};sales.forEach(s=>itemsOf(s).forEach(it=>{byProduct[it.product]=(byProduct[it.product]||0)+(+it.qty||1)}));const topC=Object.entries(byCustomer).sort((x,y)=>y[1]-x[1]).slice(0,5),topP=Object.entries(byProduct).sort((x,y)=>y[1]-x[1]).slice(0,5);$('#reportResults').innerHTML=`<div class="card"><h3>Período: ${escapeHtml(a)} até ${escapeHtml(b)}</h3><p>Vendas realizadas: <b>${money(gross)}</b></p><p>Recebido no período (pelas vendas registradas): <b>${money(received)}</b></p><p>Em aberto dessas vendas: <b>${money(open)}</b></p><p>Despesas: <b>${money(costs)}</b></p><p>Saldo de caixa estimado: <b>${money(received-costs)}</b></p></div><div class="card"><h3>Clientes com maior valor vendido</h3>${topC.length?topC.map(([id,v])=>`<p>${escapeHtml(customerName(id))}: ${money(v)}</p>`).join(''):'<p class="muted">Sem vendas associadas a clientes.</p>'}</div><div class="card"><h3>Produtos mais vendidos por quantidade</h3>${topP.length?topP.map(([id,v])=>`<p>${escapeHtml(productName(id))}: ${v}</p>`).join(''):'<p class="muted">Sem vendas.</p>'}</div>`});
$('#exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({format:'MinhaLojaLocalBackupV1',createdAt:new Date().toISOString(),data},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='backup-minha-loja-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('#importFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(obj.format!=='MinhaLojaLocalBackupV1'||!obj.data||!Array.isArray(obj.data.sales)||!Array.isArray(obj.data.customers)||!Array.isArray(obj.data.products)||!Array.isArray(obj.data.expenses))throw new Error('Arquivo inválido');if(confirm('Restaurar este backup? Os dados atuais serão substituídos.')){data={personal:[],personalCats:[],...obj.data};normalizeSales();save();alert('Backup restaurado.')}}catch(err){alert('Não foi possível restaurar. Confira se escolheu um backup do Minha Loja.')}e.target.value=''});

function openFicha(id){currentCustomer=id;go('ficha');window.scrollTo(0,0)}
function renderFicha(){if(page!=='ficha')return;const c=data.customers.find(x=>x.id===currentCustomer);if(!c){$('#fichaBody').innerHTML='<div class="empty">Cliente não encontrado.</div>';return}
const ss=salesOf(c.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));const groups={};ss.forEach(s=>{const k=(s.date||'').slice(0,7);(groups[k]=groups[k]||[]).push(s)});
const mini=(t,v)=>`<div class="card"><div class="muted">${t}</div><div class="metric" style="font-size:20px">${v}</div></div>`;
$('#fichaBody').innerHTML=`<h2 style="margin-top:14px">${nameHtml(c)}</h2><div class="muted">${statusText(c)}</div><div class="muted">${escapeHtml(c.phone||'Sem telefone')}${c.notes?' • '+escapeHtml(c.notes):''}</div><div class="grid" style="margin-top:10px">${mini('Compras',ss.length)}${mini('Total comprado',money(sum(ss,s=>+s.total||0)))}${mini('Já pagou',money(sum(ss,s=>+s.paid||0)))}${mini('Em aberto',money(sum(ss,openAmount)))}</div><div class="row" style="margin-top:6px">${sum(ss,openAmount)>0?`<button data-cust-pay="${c.id}">Registrar pagamento</button>`:''}<button class="secondary" data-sale-for="${c.id}">+ Nova venda</button><button class="secondary" data-wa="${c.id}">WhatsApp</button>${sum(ss,openAmount)>0?`<button class="secondary" data-wa-charge="${c.id}">Cobrar no WhatsApp</button>`:''}<button class="secondary" data-edit-customer="${c.id}">Editar dados</button></div>${payHistoryHtml(ss)}<h3 style="margin-top:16px">Histórico de compras</h3>`+(ss.length?Object.keys(groups).sort().reverse().map(k=>`<div class="month">${monthLabel(k)} <span class="muted">• ${money(sum(groups[k],s=>+s.total||0))}</span></div>${salesMarkup(groups[k],true)}`).join(''):'<div class="empty">Este cliente ainda não tem compras.</div>')}
function buy(id){const p=data.products.find(x=>x.id===id);if(!p)return;const q=prompt('Quantas unidades de "'+p.name+'" você comprou?','1');if(q===null)return;const qty=Math.floor(Number(q.replace(',','.')));if(!Number.isFinite(qty)||qty<1){alert('Digite uma quantidade válida.');return}const c=prompt('Quanto pagou por unidade? (R$)',String(p.cost||''));if(c===null)return;const unit=Number(c.replace(',','.'));if(!Number.isFinite(unit)||unit<=0){alert('Digite um valor maior que zero.');return}p.cost=unit;addPurchase(p,qty,unit,today());save();alert('Compra lançada em Despesas: '+money(unit*qty)+'\nEstoque agora: '+p.stock+' un.')}
document.addEventListener('click',e=>{const f=e.target.closest('[data-ficha]');if(f&&!e.target.closest('[data-del-customer],[data-pay],[data-del-sale]')){openFicha(f.dataset.ficha);return}
const sf=e.target.closest('[data-sale-for]');if(sf){go('vendas');$('#saleCustomer').value=sf.dataset.saleFor;window.scrollTo(0,0);return}
const bb=e.target.closest('[data-buy]');if(bb)buy(bb.dataset.buy)});
function periodRange(v){v=v||$('#panelPeriod').value;const n=new Date(),y=n.getFullYear(),m=n.getMonth(),iso=d=>d.toLocaleDateString('en-CA');
if(v==='mes')return[iso(new Date(y,m,1)),iso(new Date(y,m+1,0))];if(v==='mesPassado')return[iso(new Date(y,m-1,1)),iso(new Date(y,m,0))];if(v==='30d')return[iso(new Date(y,m,n.getDate()-29)),iso(n)];if(v==='ano')return[y+'-01-01',y+'-12-31'];return['0000-01-01','9999-12-31']}
function bars(items,cls,max){if(!items.length)return '<div class="empty">Sem dados no período.</div>';max=max||Math.max(...items.map(i=>i.value))||1;return items.map(i=>`<div class="bar${i.id?' link':''}" ${i.id?`data-ficha="${escapeHtml(i.id)}"`:''}><div class="lbl" title="${escapeHtml(i.label)}">${i.labelHtml||escapeHtml(i.label)}</div><div class="track"><div class="fill ${cls||''}" style="width:${Math.max(2,i.value/max*100)}%"></div></div><div class="val">${i.text}</div></div>`).join('')}
function groupBy(arr,keyFn){const g={};arr.forEach(x=>{const k=keyFn(x);(g[k]=g[k]||[]).push(x)});return g}
function renderPanel(){renderDue();renderStockBox();renderProductSummary();renderFutureBox();renderReceivable();const [a,b]=periodRange();const inP=x=>{const d=x.date||'';return d>=a&&d<=b};const ss=data.sales.filter(inP),ex=data.expenses.filter(inP);
$('#panelRange').textContent=$('#panelPeriod').value==='tudo'?'Todo o período':fmtDate(a)+' a '+fmtDate(b);
const sold=sum(ss,s=>+s.total||0),received=sum(ss,s=>+s.paid||0),open=sum(ss,openAmount),spent=sum(ex,x=>+x.amount||0);
const cogs=sum(ss,costOfSale);
$('#mRecebido').textContent=money(received);$('#mAberto').textContent=money(open);$('#mDespesas').textContent=money(spent);$('#mSaldo').textContent=money(received-spent);
$('#mLucro').textContent=money(sold-cogs);$('#mLucro').style.color=(sold-cogs)<0?'var(--red)':'';$('#mLucroInfo').textContent='Vendido '+money(sold)+' − custo dos produtos vendidos '+money(cogs);
const mS=groupBy(ss,s=>(s.date||'').slice(0,7)),mE=groupBy(ex,x=>(x.date||'').slice(0,7));const keys=[...new Set([...Object.keys(mS),...Object.keys(mE)])].sort().reverse().slice(0,12);
const vals=keys.map(k=>[sum(mS[k]||[],s=>+s.total||0),sum(mE[k]||[],x=>+x.amount||0)]);const mx=Math.max(1,...vals.flat());
$('#panelMonths').innerHTML=keys.length?keys.map((k,i)=>`<div class="month">${monthLabel(k)}${k>today().slice(0,7)?' <span class="pill bad">data futura — confira</span>':''}</div>`+bars([{label:'Vendido',value:vals[i][0],text:money(vals[i][0])}],'',mx)+bars([{label:'Despesas',value:vals[i][1],text:money(vals[i][1])}],'exp',mx)).join(''):'<div class="empty">Sem dados no período.</div>';
const byC=groupBy(ss.filter(s=>s.customer||s.customerName),s=>s.customer||('n:'+s.customerName));
$('#panelCustomers').innerHTML=bars(Object.values(byC).map(g=>({id:data.customers.some(c=>c.id===g[0].customer)?g[0].customer:'',label:customerName(g[0].customer,g[0]),labelHtml:whoHtml(g[0]),value:sum(g,s=>+s.total||0),text:money(sum(g,s=>+s.total||0))+' • '+g.length+'x'})).sort((x,y)=>y.value-x.value).slice(0,8));
const byP=groupBy(ss.flatMap(s=>itemsOf(s).map(it=>({s,it}))),x=>x.it.product);
$('#panelProducts').innerHTML=bars(Object.values(byP).map(g=>({label:productName(g[0].it.product,g[0].it),value:sum(g,x=>+x.it.qty||1),text:sum(g,x=>+x.it.qty||1)+' un. • '+money(sum(g,x=>itemRev(x.s,x.it)))})).sort((x,y)=>y.value-x.value).slice(0,8));
const byE=groupBy(ex,x=>x.category||'Outras');
$('#panelExpenses').innerHTML=bars(Object.entries(byE).map(([k,g])=>({label:k,value:sum(g,x=>+x.amount||0),text:money(sum(g,x=>+x.amount||0))})).sort((x,y)=>y.value-x.value),'exp');
const byD=groupBy(data.sales.filter(s=>openAmount(s)>0),s=>s.customer||('n:'+(s.customerName||'')));
$('#panelDebtors').innerHTML=Object.keys(byD).length?bars(Object.values(byD).map(g=>({id:data.customers.some(c=>c.id===g[0].customer)?g[0].customer:'',label:g[0].customer||g[0].customerName?customerName(g[0].customer,g[0]):'Venda sem cliente',labelHtml:whoHtml(g[0]),value:sum(g,openAmount),text:money(sum(g,openAmount))})).sort((x,y)=>y.value-x.value),'exp'):'<div class="empty">Ninguém devendo. 🎉</div>'}
$('#panelPeriod').addEventListener('change',renderPanel);

/* ===== Tema claro/escuro ===== */
const THEME='minhaLojaLocal_theme',NOTIF='minhaLojaLocal_notified_v1';
function getTheme(){try{return localStorage.getItem(THEME)||'auto'}catch(e){return 'auto'}}
const ACCENT='minhaLojaLocal_accent';
const HUES=[['Verde',147],['Azul',214],['Turquesa',182],['Roxo',266],['Rosa',328],['Vermelho',4],['Laranja',26]];
function getAccent(){try{const v=parseInt(localStorage.getItem(ACCENT),10);return Number.isFinite(v)?v:147}catch(e){return 147}}
const hsl=(h,s,l)=>`hsl(${h} ${s}% ${l}%)`;
function hex(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')}
function hueOf(hx){const r=parseInt(hx.slice(1,3),16)/255,g=parseInt(hx.slice(3,5),16)/255,b=parseInt(hx.slice(5,7),16)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;if(!d)return 147;let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h=Math.round(h*60);return (h+360)%360}
function applyTheme(){const t=getTheme(),root=document.documentElement;if(t==='auto')root.removeAttribute('data-theme');else root.setAttribute('data-theme',t);const dark=t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);
const h=getAccent(),st=root.style,props=['--green','--dark','--bg','--line','--text','--header','--card','--soft','--soft-text','--field','--muted','--metric','--pill-text'];let meta=dark?'#0f3d24':'#16834a';
if(h===147){props.forEach(p=>st.removeProperty(p))}else{const warm=h>=20&&h<=70,S=warm?90:70,Lb=warm?33:31;const v=dark?{'--green':hsl(h,S-5,Lb+2),'--dark':hsl(h,70,22),'--bg':hsl(h,30,8),'--line':hsl(h,22,20),'--text':hsl(h,25,91),'--header':hsl(h,60,17),'--card':hsl(h,22,12),'--soft':hsl(h,30,18),'--soft-text':hsl(h,50,82),'--field':hsl(h,20,28),'--muted':hsl(h,12,64),'--metric':hsl(h,55,65),'--pill-text':hsl(h,50,82)}:{'--green':hsl(h,S,Lb),'--dark':hsl(h,80,20),'--bg':hsl(h,30,96),'--line':hsl(h,22,88),'--text':hsl(h,40,15),'--header':hsl(h,S,Lb),'--card':'#fff','--soft':hsl(h,40,92),'--soft-text':hsl(h,80,20),'--field':hsl(h,18,80),'--muted':hsl(h,10,40),'--metric':hsl(h,80,20),'--pill-text':hsl(h,70,22)};Object.entries(v).forEach(([k,x])=>st.setProperty(k,x));meta=dark?hex(h,60,17):hex(h,S,Lb)}
const m=document.querySelector('meta[name=theme-color]');if(m)m.content=meta;renderSwatches()}
function renderSwatches(){const el=$('#swatches');if(!el)return;const cur=getAccent();el.innerHTML=HUES.map(([n,h])=>`<button type="button" class="swatch${h===cur?' sel':''}" data-hue="${h}" title="${n}" aria-label="${n}" style="background:${hsl(h,(h>=20&&h<=70)?90:70,31)}"></button>`).join('')}
function setAccent(h){try{localStorage.setItem(ACCENT,String(h))}catch(e){}applyTheme()}
document.addEventListener('click',e=>{const s=e.target.closest('.swatch');if(s)setAccent(+s.dataset.hue)});
$('#accentCustom').addEventListener('input',e=>setAccent(hueOf(e.target.value)));
$('#accentReset').addEventListener('click',()=>setAccent(147));
applyTheme();try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme)}catch(e){}
$('#themeSelect').value=getTheme();
$('#themeSelect').addEventListener('change',e=>{try{localStorage.setItem(THEME,e.target.value)}catch(err){}applyTheme()});
/* ===== Datas e cobranças ===== */
function daysUntil(iso){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');if(!m)return 9999;const t=today().split('-').map(Number);return Math.round((Date.UTC(+m[1],+m[2]-1,+m[3])-Date.UTC(t[0],t[1]-1,t[2]))/864e5)}
function parseDue(v){v=String(v).trim();if(!v)return '';if(/^\d{1,3}$/.test(v)){const d=new Date();d.setDate(d.getDate()+ +v);return d.toLocaleDateString('en-CA')}const m=/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/.exec(v);if(!m)return null;let y=m[3]?+m[3]:new Date().getFullYear();if(y<100)y+=2000;const dt=new Date(y,+m[2]-1,+m[1]);if(dt.getMonth()!==+m[2]-1)return null;return dt.toLocaleDateString('en-CA')}
function dueList(){return allReceipts().filter(r=>r.date).map(r=>({s:r.s,date:r.date,amount:r.amount,days:daysUntil(r.date)})).filter(x=>x.days<=7).sort((a,b)=>a.days-b.days)}
function renderDue(){const el=$('#dueBox'),list=dueList();if(!list.length){el.innerHTML='';return}
el.innerHTML='<div class="card"><h2>Cobranças</h2>'+list.map(({s,days,date,amount})=>{const c=data.customers.find(x=>x.id===s.customer);const tag=days<0?`<span class="pill bad">atrasada ${-days} dia(s)</span>`:days===0?'<span class="pill warn">hoje</span>':`<span class="pill">em ${days} dia(s)</span>`;return `<div class="item sale"><div class="details"><b>${whoHtml(s)}</b> ${tag}<div class="muted">${escapeHtml(saleLabel(s))} • cobrar em ${escapeHtml(fmtDate(date))} • falta ${money(amount)}</div></div><div class="row" style="flex:1 1 100%">${c?`<button class="small" data-wa-charge="${c.id}">Cobrar no WhatsApp</button>`:''}${c?`<button class="secondary small" data-cust-pay="${c.id}">Registrar pagamento</button>`:`<button class="secondary small" data-pay="${s.id}">Registrar pagamento</button>`}</div></div>`}).join('')+'</div>'}
function restockList(){return data.products.filter(p=>p.stock!==undefined&&(+p.stock||0)<=(p.minStock===undefined?2:+p.minStock)).map(p=>{const min=p.minStock===undefined?2:+p.minStock,st=+p.stock||0,target=Math.max(min*2,min+2),need=Math.max(1,target-st);return{p,st,need,cost:need*(+p.cost||0)}}).sort((a,b)=>a.st-b.st||a.p.name.localeCompare(b.p.name,'pt-BR'))}
function renderStockBox(){const el=$('#stockBox'),low=restockList();if(!low.length){el.innerHTML='';return}
el.innerHTML='<div class="card"><h2>Precisa repor</h2><p class="muted">Produtos no limite de aviso ou abaixo dele. A quantidade sugerida leva o estoque ao dobro do limite de aviso.</p>'+low.map(({p,st,need,cost})=>`<div class="item sale"><div class="details"><b>${escapeHtml(p.name)}</b> ${st<=0?'<span class="pill bad">sem estoque</span>':'<span class="pill warn">restam '+st+' un.</span>'}<div class="muted">Sugestão: comprar ${need} un.${cost>0?' • gasto estimado '+money(cost):''}</div></div><div class="row" style="flex:1 1 100%"><button class="secondary small" data-buy="${p.id}">Registrar compra</button></div></div>`).join('')+`<div class="month">Total estimado para repor: ${money(sum(low,x=>x.cost))}</div></div>`}
function renderProductSummary(){const el=$('#panelProfit');
const buys=data.expenses.filter(x=>x.auto||x.category==='Reposição'),spent=sum(buys,x=>+x.amount||0);
const costOf=costOfSale;
const sold=sum(data.sales,s=>+s.total||0),cogs=sum(data.sales,costOf),profit=sold-cogs;
const stockCost=sum(data.products.filter(p=>p.stock!==undefined),p=>Math.max(0,+p.stock||0)*(+p.cost||0)),stockProfit=sum(data.products.filter(p=>p.stock!==undefined),p=>Math.max(0,+p.stock||0)*((+p.price||0)-(+p.cost||0)));
const mini=(t,v,c)=>`<div class="card"><div class="muted">${t}</div><div class="metric" style="font-size:20px${c?';color:'+c:''}">${v}</div></div>`;
const byP=groupBy(data.sales.flatMap(s=>itemsOf(s).map(it=>({s,it}))),x=>x.it.product),rank=Object.values(byP).map(g=>({label:productName(g[0].it.product,g[0].it),value:sum(g,x=>itemRev(x.s,x.it)-itemCost(x.it)),qty:sum(g,x=>+x.it.qty||1)})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value).slice(0,5);
el.innerHTML=`<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin:0">${mini('Gasto comprando produtos',money(spent))}${mini('Total vendido',money(sold))}${mini('Custo dos produtos vendidos',money(cogs))}${mini('Lucro total',money(profit),profit<0?'var(--red)':'')}${mini('Dinheiro parado em estoque',money(stockCost))}${mini('Lucro previsto do estoque',money(stockProfit))}</div><div class="muted" style="margin-top:6px">Lucro total = tudo que vendeu − o que pagou nos produtos vendidos (todo o período, sem contar despesas da loja).</div><h3 style="margin-top:14px">Produtos que mais deram lucro</h3>`+bars(rank.map(x=>({label:x.label,value:x.value,text:money(x.value)+' • '+x.qty+' un.'})))}
function updateSaleStockInfo(){const el=$('#saleStockInfo');if(!el)return;const p=data.products.find(x=>x.id===$('#saleProduct').value);if(!p){el.textContent='';return}el.textContent=p.stock===undefined?'Estoque deste produto não está sendo controlado.':'Estoque disponível: '+p.stock+' un.'}
/* ===== Notificações ===== */
function notifState(){return 'Notification' in window?Notification.permission:'unsupported'}
function updateNotifUI(){const st=notifState();$('#notifStatus').textContent=st==='granted'?'Notificações ativadas.':st==='denied'?'Notificações bloqueadas. Libere nas configurações do navegador/Android.':st==='unsupported'?'Este navegador não suporta notificações.':'Notificações desativadas.';$('#notifBtn').classList.toggle('hidden',st!=='default');$('#notifTest').classList.toggle('hidden',st!=='granted')}
async function showNotif(title,body,tag){try{const reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();if(reg&&reg.showNotification){await reg.showNotification(title,{body,tag,icon:'icon-192.png',badge:'icon-192.png'});return}}catch(e){}try{new Notification(title,{body,tag})}catch(e){}}
function checkDue(){if(notifState()!=='granted'||$('#app').classList.contains('hidden'))return;const t=today();let seen={};try{seen=JSON.parse(localStorage.getItem(NOTIF)||'{}')}catch(e){}const fresh=dueList().filter(x=>x.days<=0&&seen[x.s.id+'|'+x.date]!==t);if(!fresh.length)return;fresh.forEach(x=>seen[x.s.id+'|'+x.date]=t);try{localStorage.setItem(NOTIF,JSON.stringify(seen))}catch(e){}
showNotif(fresh.length===1?'Dia de cobrança':fresh.length+' cobranças para hoje',fresh.slice(0,4).map(x=>(x.s.customer||x.s.customerName?customerName(x.s.customer,x.s):'Venda sem cliente')+' — '+money(x.amount)+(x.days<0?' (atrasada)':'')).join('\n'),'cobranca-'+t)}
$('#notifBtn').addEventListener('click',async()=>{try{await Notification.requestPermission()}catch(e){}updateNotifUI();checkDue()});
$('#notifTest').addEventListener('click',()=>showNotif('Minha Loja','Teste: as notificações estão funcionando.','teste'));
setInterval(checkDue,30*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();checkDue()}});
/* ===== WhatsApp ===== */
function waNumber(phone){let d=String(phone||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.length===10||d.length===11)d='55'+d;return d.length>=12?d:''}
function openWA(id,msg){const c=data.customers.find(x=>x.id===id);if(!c){alert('Cliente não encontrado.');return}const n=waNumber(c.phone);if(!n){alert('Cadastre o telefone de '+c.name+' (com DDD) para abrir o WhatsApp. Use "Editar dados" na ficha do cliente.');return}window.open('https://wa.me/'+n+(msg?'?text='+encodeURIComponent(msg):''),'_blank','noopener')}
function chargeMsg(c){const ops=salesOf(c.id).filter(s=>openAmount(s)>0).sort((a,b)=>(a.date||'').localeCompare(b.date||''));const first=c.name.trim().split(/\s+/)[0];return 'Olá, '+first+'! Tudo bem? Passando para lembrar do valor em aberto:\n'+ops.map(s=>'• '+fmtDate(s.date)+' – '+saleLabel(s)+': '+money(openAmount(s))).join('\n')+'\nTotal: '+money(sum(ops,openAmount))+'\nQualquer dúvida é só me chamar. Obrigada!'}
function editCustomer(id){const c=data.customers.find(x=>x.id===id);if(!c)return;const n=prompt('Nome do cliente:',c.name);if(n===null)return;if(!n.trim()){alert('O nome não pode ficar vazio.');return}const ph=prompt('Telefone com DDD (usado no WhatsApp):',c.phone||'');if(ph===null)return;const nt=prompt('Observações:',c.notes||'');if(nt===null)return;c.name=n.trim();c.phone=ph.trim();c.notes=nt.trim();data.sales.forEach(s=>{if(s.customer===c.id)s.customerName=c.name});save()}
document.addEventListener('click',e=>{
const w=e.target.closest('[data-wa]');if(w){openWA(w.dataset.wa);return}
const wc=e.target.closest('[data-wa-charge]');if(wc){const c=data.customers.find(x=>x.id===wc.dataset.waCharge);if(c)openWA(c.id,chargeMsg(c));return}
const ec=e.target.closest('[data-edit-customer]');if(ec){editCustomer(ec.dataset.editCustomer);return}
const du=e.target.closest('[data-due]');if(du){const s=data.sales.find(x=>x.id===du.dataset.due);if(!s)return;const v=prompt('Cobrar quando? Digite a data (dd/mm/aaaa) ou em quantos dias (ex.: 7). Deixe vazio para remover.',s.dueDate?fmtDate(s.dueDate):'');if(v===null)return;const d=parseDue(v);if(d===null){alert('Data inválida. Exemplo: 25/12/2026 ou 7.');return}s.dueDate=d;save();return}
const sk=e.target.closest('[data-stock]');if(sk){const p=data.products.find(x=>x.id===sk.dataset.stock);if(!p)return;const q=prompt('Quantas unidades de "'+p.name+'" você tem em estoque agora?',p.stock===undefined?'':String(p.stock));if(q===null)return;const n=Math.floor(Number(q.replace(',','.')));if(!Number.isFinite(n)||n<0){alert('Digite um número válido.');return}const m=prompt('Avisar quando restar até quantas unidades?',String(p.minStock===undefined?2:p.minStock));if(m===null)return;p.stock=n;p.minStock=Math.max(0,Math.floor(Number(m.replace(',','.'))||0));save()}
});

/* ===== Classificação de clientes ===== */
const HIGHKEY='minhaLojaLocal_highN';
function highN(){try{return Math.max(2,parseInt(localStorage.getItem(HIGHKEY),10)||3)}catch(e){return 3}}
function settledDate(s){if(openAmount(s)>0)return null;const p=Array.isArray(s.payments)?s.payments:null;if(!p||!p.length)return s.date||'';let acc=0;for(const x of p.slice().sort((u,v)=>(u.date||'').localeCompare(v.date||''))){acc+=+x.amount||0;if(acc>=(+s.total||0)-0.005)return x.date||s.date||''}return p[p.length-1].date||s.date||''}
function payStatus(s){const fd=finalDue(s);if(openAmount(s)>0)return saleReceipts(s).some(r=>r.date&&daysUntil(r.date)<0)?'late':'na';const sd=settledDate(s);if(fd)return sd<=fd?'ok':'late';return sd<=(s.date||'')?'ok':'na'}
function custStats(c){const ss=salesOf(c.id),st=ss.map(payStatus),ok=st.filter(x=>x==='ok').length,late=st.filter(x=>x==='late').length;return{n:ss.length,ok,late,level:ss.length===0?'none':ss.length>=highN()?'high':'low',heart:late===0&&ok>=2}}
function nameHtml(c){const k=custStats(c);return `<span class="cn cn-${k.level}">${escapeHtml(c.name)}</span>${k.heart?' <span title="Sempre paga em dia">❤️</span>':''}`}
function whoHtml(s){const c=data.customers.find(x=>x.id===s.customer);if(c)return nameHtml(c);return s.customerName?escapeHtml(s.customerName):'Venda sem cliente'}
function statusText(c){const k=custStats(c);return (k.level==='high'?'Compra muito ('+k.n+' compras)':k.level==='low'?'Comprou pouco ('+k.n+' compra'+(k.n>1?'s':'')+')':'Ainda não comprou')+(k.heart?' • ❤️ Sempre paga em dia':'')+(k.late>0?' • ⚠️ teve atraso no pagamento':'')}
function renderLegend(){$('#custLegend').innerHTML=`<span class="cn cn-high">● Compra muito (${highN()}+ compras)</span> &nbsp; <span class="cn cn-low">● Comprou pouco</span> &nbsp; <span class="cn cn-none">● Ainda não comprou</span> &nbsp; ❤️ Sempre paga em dia`}
$('#highN').value=highN();
$('#highN').addEventListener('change',e=>{const v=Math.max(2,parseInt(e.target.value,10)||3);e.target.value=v;try{localStorage.setItem(HIGHKEY,String(v))}catch(err){}render()});

/* ===== Ordenação da lista de clientes ===== */
const SORTKEY='minhaLojaLocal_custSort';let lastL='';
function custSort(){try{return localStorage.getItem(SORTKEY)||'az'}catch(e){return 'az'}}
function sortedCustomers(){const m=custSort(),cmp=(a,b)=>a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'});const arr=data.customers.slice();
const I=new Map(arr.map(c=>{const ss=salesOf(c.id);return[c.id,{n:ss.length,op:sum(ss,openAmount),tot:sum(ss,s=>+s.total||0),last:ss.reduce((x,s)=>(s.date||'')>x?(s.date||''):x,'')}]}));
const by={az:cmp,za:(a,b)=>cmp(b,a),mais:(a,b)=>I.get(b.id).n-I.get(a.id).n||cmp(a,b),valor:(a,b)=>I.get(b.id).tot-I.get(a.id).tot||cmp(a,b),aberto:(a,b)=>I.get(b.id).op-I.get(a.id).op||cmp(a,b),recente:(a,b)=>I.get(b.id).last.localeCompare(I.get(a.id).last)||cmp(a,b)};
return arr.sort(by[m]||cmp)}
function letterHdr(c){const m=custSort();if(m!=='az'&&m!=='za')return '';let ch=(c.name.trim()[0]||'#').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();if(!/[A-Z]/.test(ch))ch='#';if(ch===lastL)return '';lastL=ch;return `<div class="month" data-letter>${ch}</div>`}
function filterCustomers(){const q=normQ($('#customerSearch').value);let hdr=null,any=false;const flush=()=>{if(hdr)hdr.classList.toggle('hidden',!any)};$$('#customersList>*').forEach(el=>{if(el.hasAttribute('data-letter')){flush();hdr=el;any=false}else{const show=normQ(el.dataset.q||el.textContent).includes(q);el.classList.toggle('hidden',!show);if(show)any=true}});flush()}
$('#custSort').value=custSort();
$('#custSort').addEventListener('change',e=>{try{localStorage.setItem(SORTKEY,e.target.value)}catch(err){}render()});

/* ===== Visual 3D futurista e sons ===== */
const FXKEY='minhaLojaLocal_fx',SNDKEY='minhaLojaLocal_sound';
const fxOn=()=>{try{return localStorage.getItem(FXKEY)!=='off'}catch(e){return true}};
const soundOn=()=>{try{return localStorage.getItem(SNDKEY)!=='off'}catch(e){return true}};
function applyFx(){document.documentElement.classList.toggle('fx3d',fxOn())}
applyFx();
$('#fxSelect').value=fxOn()?'on':'off';$('#soundSelect').value=soundOn()?'on':'off';
$('#fxSelect').addEventListener('change',e=>{try{localStorage.setItem(FXKEY,e.target.value)}catch(err){}applyFx()});
$('#soundSelect').addEventListener('change',e=>{try{localStorage.setItem(SNDKEY,e.target.value)}catch(err){}playSound('ok')});
let audioCtx=null;
function tone(freq,dur,type,vol,when,slide){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audioCtx=audioCtx||new AC();if(audioCtx.state==='suspended')audioCtx.resume();const t=audioCtx.currentTime+(when||0),o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type||'sine';o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol||.05,t+.008);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+dur+.03)}
function playSound(kind){if(!soundOn())return;try{
if(kind==='tick')tone(880,.06,'triangle',.05,0,1320);
else if(kind==='sec')tone(700,.05,'triangle',.04,0,950);
else if(kind==='nav')tone(520,.08,'sine',.05,0,820);
else if(kind==='danger')tone(240,.15,'sawtooth',.035,0,110);
else if(kind==='warn'){tone(300,.1,'square',.025);tone(240,.14,'square',.025,.11)}
else if(kind==='ok'){tone(660,.09,'sine',.06);tone(990,.16,'sine',.06,.09)}
}catch(e){}}
document.addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(b){if(b.disabled)return;playSound(b.closest('#nav')?'nav':b.classList.contains('danger')?'danger':b.classList.contains('secondary')?'sec':'tick');return}if(e.target.closest('.link,[data-ficha]'))playSound('sec')},true);
const _alert=window.alert.bind(window);window.alert=m=>{playSound(/salv|lançad|restaurad|ativad|funcionando|registrad/i.test(String(m))?'ok':'warn');_alert(m)};

const normQ=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
/* ===== Pagamento por cliente (abate o saldo devedor) ===== */
function parseMoney(v){v=String(v).trim().replace(/[R$\s]/g,'');if(v.includes(','))v=v.replace(/\./g,'').replace(',','.');return Number(v)}
function customerPay(id){const c=data.customers.find(x=>x.id===id);if(!c)return;const open=salesOf(c.id).filter(s=>openAmount(s)>0).sort((x,y)=>(x.date||'').localeCompare(y.date||''));const owed=Math.round(sum(open,openAmount)*100);if(!owed){alert('Este cliente não tem valor em aberto.');return}
const v=prompt('Quanto '+c.name+' pagou agora?\nSaldo devedor: '+money(owed/100)+'\nO valor abate do saldo, começando pelas compras mais antigas.',(owed/100).toFixed(2).replace('.',','));if(v===null)return;
const n=parseMoney(v);if(!Number.isFinite(n)||n<=0){alert('Digite um valor maior que zero.');return}const cents=Math.round(n*100);if(cents>owed){alert('O valor é maior que o saldo devedor ('+money(owed/100)+'). Digite até esse valor.');return}
let rest=cents;const pid=uid(),d=today();for(const s of open){if(rest<=0)break;const take=Math.min(rest,Math.round(openAmount(s)*100));s.payments=Array.isArray(s.payments)?s.payments:(s.paid>0?[{date:s.date||d,amount:+s.paid}]:[]);s.payments.push({date:d,amount:take/100,pid});s.paid=+((Math.round((+s.paid||0)*100)+take)/100).toFixed(2);rest-=take}
save();alert('Pagamento de '+money(cents/100)+' registrado. Saldo devedor agora: '+money((owed-cents)/100)+'.')}
document.addEventListener('click',e=>{const b=e.target.closest('[data-cust-pay]');if(b)customerPay(b.dataset.custPay)});
function payHistoryHtml(ss){const g=new Map();let i=0;ss.forEach(s=>{const p=Array.isArray(s.payments)&&s.payments.length?s.payments:(s.paid>0?[{date:s.date,amount:+s.paid}]:[]);p.forEach(x=>{const k=x.pid||('l'+(i++));const o=g.get(k)||{date:x.date||'',amount:0};o.amount+=+x.amount||0;g.set(k,o)})});const list=[...g.values()];if(!list.length)return '';list.sort((x,y)=>y.date.localeCompare(x.date));const tot=sum(list,x=>x.amount);return `<h3 style="margin-top:16px">Pagamentos recebidos <span class="muted">• ${money(tot)}</span></h3>`+list.slice(0,10).map(x=>`<div class="item"><div class="details">${escapeHtml(fmtDate(x.date))}</div><b>${money(x.amount)}</b></div>`).join('')+(list.length>10?`<div class="muted">+ ${list.length-10} pagamentos mais antigos</div>`:'')}
/* ===== Produtos: ordem alfabética e busca ===== */
let lastP='';
function letterHdrP(p){let ch=(p.name.trim()[0]||'#').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();if(!/[A-Z]/.test(ch))ch='#';if(ch===lastP)return '';lastP=ch;return `<div class="month" data-letter>${ch}</div>`}
function filterProducts(){const q=normQ($('#productSearch').value);let hdr=null,any=false;const flush=()=>{if(hdr)hdr.classList.toggle('hidden',!any)};$$('#productsList>*').forEach(el=>{if(el.hasAttribute('data-letter')){flush();hdr=el;any=false}else{const show=normQ(el.dataset.q||el.textContent).includes(q);el.classList.toggle('hidden',!show);if(show)any=true}});flush()}
$('#productSearch').addEventListener('input',filterProducts);
/* ===== v9: sem senha, produtos A-Z, editar venda, a receber por mês, despesas pessoais ===== */
try{localStorage.removeItem(AUTH)}catch(e){}
const sortedProducts=()=>data.products.slice().sort((x,y)=>x.name.localeCompare(y.name,'pt-BR',{sensitivity:'base'}));
function setDateMax(){const t=today();['#saleForm','#editSaleForm','#personalForm'].forEach(s=>{const el=$(s)&&$(s).elements.date;if(el)el.max=t})}
$('#saleProductSearch').addEventListener('input',()=>{render();fillTotal();updateSaleStockInfo()});

/* --- Vendas com data futura (explica "vendi em dezembro" estando em novembro) --- */
function renderFutureBox(){const el=$('#futureBox'),t=today(),fut=data.sales.filter(s=>(s.date||'')>t).sort((a,b)=>a.date.localeCompare(b.date));
if(!fut.length){el.innerHTML='';return}
el.innerHTML='<div class="card"><h2>⚠️ Vendas com data futura</h2><p class="muted">Estas vendas estão com data depois de hoje ('+escapeHtml(fmtDate(t))+'), por isso aparecem em meses que ainda não chegaram. Provavelmente a data foi digitada errado. Toque em Corrigir data.</p>'+fut.map(s=>`<div class="item sale"><div class="details"><b>${escapeHtml(saleLabel(s))}</b> — ${money(s.total)}<div class="muted">Data lançada: ${escapeHtml(fmtDate(s.date))} • ${whoHtml(s)}</div></div><div class="row" style="flex:1 1 100%"><button class="small" data-edit-sale="${s.id}">Corrigir data</button></div></div>`).join('')+'</div>'}

/* --- Vários produtos em uma venda --- */
function normalizeSales(){data.sales.forEach(s=>{if(Array.isArray(s.items)&&s.items.length)return;s.items=[{product:s.product||'',productName:s.productName||'',qty:+s.qty||1,total:+s.total||0,costUnit:s.costUnit!=null?+s.costUnit:(data.products.find(p=>p.id===s.product)?.cost||0),stockUsed:+s.stockUsed||0}];delete s.product;delete s.productName;delete s.qty;delete s.costUnit;delete s.stockUsed})}
const itemsOf=s=>Array.isArray(s.items)?s.items:[];
const prodOf=id=>data.products.find(p=>p.id===id);
const itemCost=it=>(it.costUnit!=null?+it.costUnit:(prodOf(it.product)?.cost||0))*(+it.qty||1);
const costOfSale=s=>sum(itemsOf(s),itemCost);
const saleLabel=s=>itemsOf(s).map(it=>((+it.qty>1)?it.qty+'× ':'')+productName(it.product,it)).join(', ')||'Venda';
const saleTitle=s=>itemsOf(s).length>1?itemsOf(s).length+' produtos':saleLabel(s);
function itemRev(s,it){const sub=sum(itemsOf(s),x=>+x.total||0);return sub>0?(+it.total||0)*((+s.total||0)/sub):(+s.total||0)/Math.max(1,itemsOf(s).length)}
function itemsHtml(s){const its=itemsOf(s);if(its.length<2)return '';return '<div style="margin:4px 0">'+its.map(it=>`<div class="muted">• ${escapeHtml(it.qty)}× ${escapeHtml(productName(it.product,it))} — ${money(it.total)}</div>`).join('')+'</div>'}
let cart=[];
const cartTotal=()=>sum(cart,i=>i.unit*i.qty);
function renderCartList(){const el=$('#cartBox');if(!el)return;el.innerHTML=cart.length?'<div style="border:1px solid var(--line);border-radius:10px;padding:2px 10px;margin:8px 0"><div class="muted" style="padding-top:6px">Produtos desta venda:</div>'+cart.map((i,ix)=>`<div class="item"><div class="details"><b>${escapeHtml(i.qty)}× ${escapeHtml(productName(i.product))}</b> — ${money(i.unit*i.qty)}</div><button type="button" class="danger small" data-rm-cart="${ix}" aria-label="Remover">✕</button></div>`).join('')+'</div>':''}
$('#addItemBtn').addEventListener('click',()=>{const p=prodOf($('#saleProduct').value),q=Math.floor(+$('#saleForm').elements.qty.value||0);if(!p){alert('Escolha um produto.');return}if(q<1){alert('Digite a quantidade.');return}const ex=cart.find(i=>i.product===p.id);if(ex)ex.qty+=q;else cart.push({product:p.id,qty:q,unit:+p.price||0});$('#saleForm').elements.qty.value=1;renderCartList();fillTotal()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-rm-cart]');if(b){cart.splice(+b.dataset.rmCart,1);renderCartList();fillTotal()}});
$('#saleForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),total=+f.get('total'),paid=+f.get('paid')||0;
let lines=cart.map(i=>({...i}));
if(!lines.length){const p=prodOf(f.get('product')),q=Math.floor(+f.get('qty')||0);if(!p){alert('Cadastre um produto antes de registrar uma venda.');return}if(q<1){alert('Digite a quantidade.');return}lines=[{product:p.id,qty:q,unit:+p.price||0}]}
if(paid>total){alert('O valor pago não pode ser maior que o total da venda.');return}
const pc=buildParcelas(getParc('#saleParc'),total-paid);if(!pc.ok){alert(pc.msg);return}
const short=lines.filter(l=>{const p=prodOf(l.product);return p&&p.stock!==undefined&&l.qty>Math.max(0,+p.stock||0)});
if(short.length&&!confirm('Estoque insuficiente: '+short.map(l=>{const p=prodOf(l.product);return p.name+' (há '+Math.max(0,+p.stock||0)+' un., venda de '+l.qty+')'}).join('; ')+'. Registrar a venda mesmo assim?'))return;
const items=lines.map(l=>{const p=prodOf(l.product);let used=0;if(p.stock!==undefined){const a=Math.max(0,+p.stock||0);used=Math.min(l.qty,a);p.stock=a-used}return{product:p.id,productName:p.name,qty:l.qty,total:+(l.unit*l.qty).toFixed(2),costUnit:p.cost||0,stockUsed:used}});
const cust=data.customers.find(c=>c.id===f.get('customer'));
data.sales.push({id:uid(),customer:cust?cust.id:'',customerName:cust?cust.name:'',items,total,paid,payments:paid>0?[{date:f.get('date')||today(),amount:paid}]:[],date:f.get('date')||today(),dueDate:pc.due,parcelas:pc.parcelas,notes:f.get('notes')});
cart=[];e.target.reset();setParc('#saleParc',[]);$('#saleForm').elements.qty.value=1;$('#saleForm').elements.date.value=today();$('#saleTotal').value='';save();
const low=items.map(i=>prodOf(i.product)).filter(p=>p&&p.stock!==undefined&&p.stock<=(p.minStock===undefined?2:+p.minStock));
alert('Venda salva.'+(cust?' Ela já aparece na ficha de '+cust.name+'.':'')+(low.length?'\nAtenção, estoque baixo: '+low.map(p=>p.name+' ('+p.stock+' un.)').join(', ')+'.':''))});

/* --- Linhas de produtos na edição da venda --- */
function editRow(it){const opts=sortedProducts().map(p=>`<option value="${p.id}"${it&&p.id===it.product?' selected':''}>${escapeHtml(p.name)}</option>`).join('')+(it&&it.product&&!prodOf(it.product)?`<option value="${escapeHtml(it.product)}" selected>${escapeHtml(it.productName||'Produto removido')} (removido)</option>`:'');return `<div class="row prow erow" style="flex-wrap:nowrap"><select class="ep" style="min-width:0">${opts}</select><input type="number" class="eq" min="1" step="1" value="${it?escapeHtml(it.qty):1}" style="flex:0 0 74px;min-width:0"><button type="button" class="danger small" data-rm-erow aria-label="Remover produto" style="flex:0 0 44px;min-width:44px">✕</button></div>`}
function editLines(){const m=new Map();$$('#editItems .erow').forEach(r=>{const id=r.querySelector('.ep').value,q=Math.floor(+r.querySelector('.eq').value||0);if(id&&q>0)m.set(id,(m.get(id)||0)+q)});return[...m].map(([product,qty])=>({product,qty}))}
function editUnit(s,id){const o=itemsOf(s).find(i=>i.product===id);return o&&o.qty>0?o.total/o.qty:(+prodOf(id)?.price||0)}
function syncEditTotal(){const s=data.sales.find(x=>x.id===editingSale);if(!s)return;$('#editSaleForm').elements.total.value=sum(editLines(),l=>editUnit(s,l.product)*l.qty).toFixed(2)}
$('#editItems').addEventListener('input',syncEditTotal);$('#editItems').addEventListener('change',syncEditTotal);
$('#editAddItem').addEventListener('click',()=>{$('#editItems').insertAdjacentHTML('beforeend',editRow(null));syncEditTotal()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-rm-erow]');if(b){const row=b.closest('.erow');if($$('#editItems .erow').length>1){row.remove();syncEditTotal()}else alert('A venda precisa ter pelo menos um produto.')}});

/* --- Parcelas / várias datas de cobrança --- */
function parcStatus(s){const P=(Array.isArray(s.parcelas)?s.parcelas:[]).slice().sort((a,b)=>a.date.localeCompare(b.date));if(!P.length)return null;const tot=sum(P,x=>+x.amount||0);let extra=Math.max(0,(+s.paid||0)-((+s.total||0)-tot));return P.map(x=>{const a=+x.amount||0,use=Math.min(a,extra);extra-=use;return{date:x.date,amount:a,rest:+(a-use).toFixed(2)}})}
function saleReceipts(s){const op=openAmount(s);if(op<=0.004)return[];const ps=parcStatus(s);if(!ps)return[{date:s.dueDate||'',amount:op}];const out=ps.filter(x=>x.rest>0.004).map(x=>({date:x.date,amount:x.rest}));const left=+(op-sum(out,x=>x.amount)).toFixed(2);if(left>0.004)out.push({date:'',amount:left});return out}
const allReceipts=()=>data.sales.flatMap(s=>saleReceipts(s).map(r=>({s,...r})));
function finalDue(s){const ps=parcStatus(s);return ps?ps[ps.length-1].date:(s.dueDate||'')}
function parcLine(s){const ps=parcStatus(s);if(!ps||ps.length<2)return '';return '<div class="muted">Parcelas: '+ps.map(x=>escapeHtml(fmtDate(x.date).slice(0,5))+' '+money(x.amount)+(x.rest<=0.004?' ✓':'')).join(' • ')+'</div>'}
function parcRowsOf(s){const rs=saleReceipts(s).filter(r=>r.date);if(rs.length)return rs.map(r=>({date:r.date,amount:(s.parcelas&&s.parcelas.length)?r.amount.toFixed(2):''}));return s.dueDate?[{date:s.dueDate,amount:''}]:[]}
function parcRow(d,a){return `<div class="row prow" style="flex-wrap:nowrap"><input type="date" class="pd" value="${escapeHtml(d||'')}"><input type="number" class="pv" min="0" step=".01" inputmode="decimal" placeholder="Valor" value="${escapeHtml(a===undefined||a===null?'':a)}"><button type="button" class="danger small" data-rm-parc aria-label="Remover data" style="flex:0 0 44px;min-width:44px">✕</button></div>`}
function setParc(sel,arr){$(sel).innerHTML=(arr&&arr.length?arr:[{}]).map(x=>parcRow(x.date,x.amount)).join('')}
function getParc(sel){return $$(sel+' .prow').map(r=>({date:r.querySelector('.pd').value,amount:r.querySelector('.pv').value}))}
function buildParcelas(rows,remaining){const r=rows.filter(x=>x.date).map(x=>({date:x.date,amount:String(x.amount).trim()===''?null:+x.amount}));
if(!r.length)return{ok:true,parcelas:[],due:''};
if(remaining<=0.004||(r.length===1&&r[0].amount===null))return{ok:true,parcelas:[],due:r.map(x=>x.date).sort()[0]};
if(r.some(x=>x.amount!==null&&!(x.amount>0)))return{ok:false,msg:'Os valores das parcelas precisam ser maiores que zero (ou deixe em branco).'};
const cents=Math.round(remaining*100),fixedC=Math.round(sum(r.filter(x=>x.amount!==null),x=>x.amount)*100),blanks=r.filter(x=>x.amount===null);
if(fixedC>cents+1)return{ok:false,msg:'As parcelas somam '+money(fixedC/100)+', mais do que falta receber ('+money(cents/100)+').'};
if(!blanks.length&&Math.abs(fixedC-cents)>1)return{ok:false,msg:'As parcelas somam '+money(fixedC/100)+', mas falta receber '+money(cents/100)+'. Ajuste os valores ou deixe um em branco.'};
if(blanks.length){const rest=cents-fixedC,base=Math.floor(rest/blanks.length);blanks.forEach((x,i)=>{x.amount=(base+(i===blanks.length-1?rest-base*blanks.length:0))/100})}
r.sort((a,b)=>a.date.localeCompare(b.date));return{ok:true,parcelas:r,due:r[0].date}}
document.addEventListener('click',e=>{const a=e.target.closest('[data-add-parc]');if(a){$('#'+a.dataset.addParc).insertAdjacentHTML('beforeend',parcRow());return}
const x=e.target.closest('[data-rm-parc]');if(x){const row=x.closest('.prow'),c=row.parentElement;if(c.querySelectorAll('.prow').length>1)row.remove();else{row.querySelector('.pd').value='';row.querySelector('.pv').value=''}}});
setParc('#saleParc',[]);

/* --- A receber por mês --- */
function renderReceivable(){const el=$('#panelReceivable'),rs=allReceipts();
if(!rs.length){el.innerHTML='<div class="empty">Nada a receber. 🎉</div>';return}
const t=today(),cur=t.slice(0,7),g=groupBy(rs,r=>(r.date||r.s.date||'').slice(0,7)),keys=Object.keys(g).sort();
el.innerHTML=`<div class="muted">Total a receber</div><div class="metric">${money(sum(rs,r=>r.amount))}</div>`+keys.map(k=>{const days=groupBy(g[k],r=>r.date||'sem');const dk=Object.keys(days).sort((a,b)=>a==='sem'?1:b==='sem'?-1:a.localeCompare(b));
return `<div class="month">${monthLabel(k)} <span class="muted">• ${money(sum(g[k],r=>r.amount))}</span>${k===cur?' <span class="pill">este mês</span>':''}</div>`+dk.map(d=>{const v=sum(days[d],r=>r.amount),n=new Set(days[d].map(r=>r.s.id)).size,late=d!=='sem'&&d<t;return `<div class="item"><div class="details"><b>${d==='sem'?'Sem data de cobrança':'Dia '+(+d.slice(8))}</b>${late?' <span class="pill bad">atrasado</span>':d===t?' <span class="pill warn">hoje</span>':''}<div class="muted">${n} venda(s)</div></div><b>${money(v)}</b></div>`}).join('')}).join('')+'<p class="muted">Cada linha é um dia de cobrança (vendas parceladas aparecem em cada data). Vendas sem data aparecem no mês da venda; defina em Vendas > Datas de cobrança.</p>'}
/* --- Editar venda --- */
let editingSale=null;
function closeEditSale(){editingSale=null;$('#editSaleModal').classList.add('hidden')}
function openEditSale(id){const s=data.sales.find(x=>x.id===id);if(!s)return;editingSale=id;const f=$('#editSaleForm').elements,cmp=(a,b)=>a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'});
let co='<option value="">Venda sem cliente</option>'+data.customers.slice().sort(cmp).map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
if(s.customer&&!data.customers.some(c=>c.id===s.customer))co+=`<option value="${escapeHtml(s.customer)}">${escapeHtml(s.customerName||'Cliente removido')} (removido)</option>`;
f.customer.innerHTML=co;f.customer.value=s.customer||'';
$('#editItems').innerHTML=itemsOf(s).map(editRow).join('');
f.total.value=(+s.total||0).toFixed(2);f.paid.value=(+s.paid||0).toFixed(2);f.date.value=s.date||today();setParc('#editParc',parcRowsOf(s));f.notes.value=s.notes||'';
setDateMax();$('#editSaleModal').classList.remove('hidden')}
$('#editSaleForm').addEventListener('submit',e=>{e.preventDefault();const s=data.sales.find(x=>x.id===editingSale);if(!s){closeEditSale();return}
const f=new FormData(e.target),total=+f.get('total'),paid=+f.get('paid')||0,newDate=f.get('date')||s.date,oldDate=s.date;
if(!(total>=0)){alert('Digite o valor total da venda.');return}
if(paid>total+0.004){alert('O valor pago não pode ser maior que o total da venda.');return}
const pc=buildParcelas(getParc('#editParc'),total-paid);if(!pc.ok){alert(pc.msg);return}
if(newDate>today()&&!confirm('A data da venda está no futuro. Salvar mesmo assim?'))return;
const lines=editLines();if(!lines.length){alert('Escolha pelo menos um produto.');return}
const oldItems=itemsOf(s),availOf=id=>{const p=prodOf(id);return p&&p.stock!==undefined?Math.max(0,(+p.stock||0)+sum(oldItems.filter(i=>i.product===id),i=>+i.stockUsed||0)):null};
const short=lines.filter(l=>{const a=availOf(l.product);return a!==null&&l.qty>a});
if(short.length&&!confirm('Estoque insuficiente: '+short.map(l=>prodOf(l.product).name+' (disponível '+availOf(l.product)+' un., venda de '+l.qty+')').join('; ')+'. Salvar mesmo assim?'))return;
oldItems.forEach(i=>{const p=prodOf(i.product);if(p&&p.stock!==undefined&&i.stockUsed)p.stock=(+p.stock||0)+(+i.stockUsed||0)});
s.items=lines.map(l=>{const p=prodOf(l.product),old=oldItems.find(i=>i.product===l.product),unit=old&&old.qty>0?old.total/old.qty:(p?+p.price||0:0);let used=old?+old.stockUsed||0:0;if(p){used=0;if(p.stock!==undefined){const a=Math.max(0,+p.stock||0);used=Math.min(l.qty,a);p.stock=a-used}}return{product:l.product,productName:p?p.name:(old?old.productName:''),qty:l.qty,total:+(unit*l.qty).toFixed(2),costUnit:old?old.costUnit:(p?p.cost||0:0),stockUsed:used}});
const cv=f.get('customer'),cust=data.customers.find(c=>c.id===cv);
if(cust){s.customer=cust.id;s.customerName=cust.name}else if(!cv){s.customer='';s.customerName=''}
s.total=total;s.date=newDate;s.dueDate=pc.due;s.parcelas=pc.parcelas;s.notes=f.get('notes')||'';
if(Math.abs(paid-(+s.paid||0))>0.004){s.payments=paid>0?[{date:newDate,amount:paid}]:[]}
else if(newDate!==oldDate&&Array.isArray(s.payments))s.payments.forEach(p=>{if(p.date===oldDate)p.date=newDate});
s.paid=paid;
closeEditSale();save();alert('Venda salva com as alterações.')});
$('#editSaleCancel').addEventListener('click',closeEditSale);
$('#editSaleModal').addEventListener('click',e=>{if(e.target===$('#editSaleModal'))closeEditSale()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&editingSale)closeEditSale()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-edit-sale]');if(b)openEditSale(b.dataset.editSale)});

/* --- Despesas pessoais (separadas da loja) --- */
const P_DEF=['Posto / Combustível','Feira / Mercado','Padaria','Farmácia','Alimentação fora','Contas da casa','Saúde','Lazer','Transporte','Outros'];
const allPCats=()=>[...new Set([...P_DEF,...(data.personalCats||[]),...(data.personal||[]).map(x=>x.category).filter(Boolean)])];
let editingPersonal=null;
function fillPCat(){const sel=$('#pCategory'),prev=sel.value,all=allPCats();sel.innerHTML=all.map(c=>`<option>${escapeHtml(c)}</option>`).join('')+'<option value="__new">➕ Nova categoria…</option>';if(prev&&all.includes(prev))sel.value=prev}
$('#pCategory').addEventListener('change',e=>{if(e.target.value!=='__new')return;const n=(prompt('Nome da nova categoria (ex.: Academia):')||'').trim();if(!n){fillPCat();return}
const low=x=>x.toLocaleLowerCase('pt-BR');let m=allPCats().find(c=>low(c)===low(n));if(!m){data.personalCats=data.personalCats||[];data.personalCats.push(n);m=n}save();$('#pCategory').value=m});
function cancelPersonalEdit(){editingPersonal=null;const f=$('#personalForm');f.reset();f.elements.date.value=today();$('#personalBtn').textContent='Salvar despesa pessoal';$('#personalTitle').textContent='Nova despesa pessoal';$('#personalCancel').classList.add('hidden')}
$('#personalCancel').addEventListener('click',cancelPersonalEdit);
$('#personalForm').elements.date.value=today();
$('#personalForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),amount=+f.get('amount'),cat=f.get('category');
if(!(amount>0)){alert('Digite um valor maior que zero.');return}
if(!cat||cat==='__new'){alert('Escolha uma categoria.');return}
data.personal=data.personal||[];const rec={description:(f.get('description')||'').trim(),category:cat,amount,date:f.get('date')||today()};
if(editingPersonal){const x=data.personal.find(y=>y.id===editingPersonal);if(x)Object.assign(x,rec)}else data.personal.push({id:uid(),...rec});
cancelPersonalEdit();save();alert('Despesa pessoal salva.')});
function editPersonal(id){const x=(data.personal||[]).find(y=>y.id===id);if(!x)return;editingPersonal=id;const f=$('#personalForm').elements;fillPCat();f.category.value=x.category;f.amount.value=x.amount;f.description.value=x.description||'';f.date.value=x.date;
$('#personalBtn').textContent='Salvar alterações';$('#personalTitle').textContent='Editando despesa pessoal';$('#personalCancel').classList.remove('hidden');$('#personalForm').scrollIntoView({behavior:'smooth',block:'center'})}
document.addEventListener('click',e=>{const ed=e.target.closest('[data-edit-personal]');if(ed){editPersonal(ed.dataset.editPersonal);return}
const dl=e.target.closest('[data-del-personal]');if(dl&&confirm('Excluir esta despesa pessoal?')){data.personal=data.personal.filter(x=>x.id!==dl.dataset.delPersonal);if(editingPersonal===dl.dataset.delPersonal)cancelPersonalEdit();save()}});
function renderPersonal(){fillPCat();const v=$('#pPeriod').value,[a,b]=periodRange(v),list=(data.personal||[]).filter(x=>(x.date||'')>=a&&(x.date||'')<=b);
$('#pRange').textContent=v==='tudo'?'Todo o período':fmtDate(a)+' a '+fmtDate(b);
const total=sum(list,x=>+x.amount||0),pct=n=>total?Math.round(n/total*100):0;$('#pTotal').textContent=money(total);
const byC=Object.entries(groupBy(list,x=>x.category||'Outros')).map(([k,g])=>({label:k,value:sum(g,x=>+x.amount||0)})).sort((x,y)=>y.value-x.value);
$('#pTop').textContent=byC.length?byC[0].label:'—';$('#pTopInfo').textContent=byC.length?money(byC[0].value)+' ('+pct(byC[0].value)+'% do total)':'Sem gastos no período';
$('#pCats').innerHTML=bars(byC.map(c=>({label:c.label,value:c.value,text:money(c.value)+' • '+pct(c.value)+'%'})),'exp');
const mG=groupBy(list,x=>(x.date||'').slice(0,7)),keys=Object.keys(mG).sort().reverse().slice(0,12),mv=keys.map(k=>sum(mG[k],x=>+x.amount||0)),mx=Math.max(1,...mv);
$('#pMonths').innerHTML=keys.length?keys.map((k,i)=>`<div class="month">${monthLabel(k)}</div>`+bars([{label:'Gasto',value:mv[i],text:money(mv[i])}],'exp',mx)).join(''):'<div class="empty">Sem gastos no período.</div>';
$('#pList').innerHTML=list.length?list.slice().sort((x,y)=>(y.date||'').localeCompare(x.date||'')).map(x=>`<div class="item sale"><div class="details"><b>${escapeHtml(x.description||x.category)}</b> — ${money(x.amount)} <span class="pill">${escapeHtml(x.category)}</span><div class="muted">${escapeHtml(fmtDate(x.date))}</div></div><div class="row" style="flex:1 1 100%"><button class="secondary small" data-edit-personal="${x.id}">Editar</button><button class="danger small" data-del-personal="${x.id}">Excluir</button></div></div>`).join(''):'<div class="empty">Nenhuma despesa pessoal no período.</div>'}
$('#pPeriod').addEventListener('change',renderPersonal);
if('serviceWorker' in navigator && location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
load();showApp();
})();