// GeoFolio, bản dùng Supabase. URL và khóa publishable được phép công khai; bảo mật do RLS đảm nhiệm.
const SUPABASE_URL='https://pnmfhvylcvhooweusrzg.supabase.co',SUPABASE_KEY='sb_publishable_JCklJbw_i5JPnmtJjRXC0g_Gep9xfnW';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s),d10=s=>String(s||'').slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db={users:[],classes:[],members:[],items:[],stops:[],projects:[],tasks:[],subs:[],pub:[]},cur=null;
const NAV={student:[['home','▦','Tổng quan'],['port','▤','Hồ sơ năng lực'],['field','⌖','Nhật ký thực địa'],['proj','◫','Dự án học tập'],['rub','✓','Đánh giá & Rubric'],['comm','◎','Kho tư liệu']],teacher:[['cls','▣','Quản lý lớp học'],['comm','◎','Kho tư liệu']],guest:[['comm','◎','Kho tư liệu']]};
const CRIT=['Độ chính xác dữ liệu','Phân tích không gian','Minh chứng thực địa','Trình bày & số hóa'];
const LV=[['Dữ liệu thiếu/sai','Cơ bản chính xác','Chính xác, có nguồn','Kiểm chứng đa nguồn'],['Mô tả rời rạc','Nêu được phân bố','Giải thích hợp lí','Phân tích đa chiều'],['Ít minh chứng','Có ảnh/ghi chép','Đủ ảnh và tọa độ','Minh chứng rõ, xác thực'],['Khó theo dõi','Đúng cấu trúc','Trực quan, khoa học','Sáng tạo, dễ khai thác']];
let view='',tab='sr',msg='',editId=null,csv='';
const fld=(n,l,t='text',x='')=>`<label>${l}<input name="${n}" type="${t}" ${x}></label>`;
const sel=(n,l,a)=>`<label>${l}<select name="${n}">${a.map(o=>`<option>${esc(o)}</option>`).join('')}</select></label>`;
const mine=(k,u)=>db[k].filter(x=>x.uid===u.id);
const myClasses=u=>db.members.filter(m=>m.uid===u.id).map(m=>db.classes.find(c=>c.id===m.cid)).filter(Boolean);
const rubAvg=u=>{const g=db.subs.filter(s=>s.uid===u.id&&s.r);return CRIT.map((_,i)=>g.length?g.reduce((a,s)=>a+s.r[i],0)/g.length*25:0)};
const delBtn=(k,id)=>`<button class="btn d" data-a="del" data-k="${k}" data-id="${id}">Xóa</button>`;
const empty=t=>`<p class="mut">${t}</p>`;

function auth(){
 const T={tr:['Đăng ký giáo viên','trReg'],tl:['Giáo viên đăng nhập','login'],sr:['Học sinh đăng ký','srReg'],sl:['Học sinh đăng nhập','login'],g:['Khách đóng góp','guest']};
 const [t,f]=T[tab],reg=tab==='tr'||tab==='sr';
 return `<div class="auth"><h1>GeoFolio</h1><p class="mut">Học tập Địa lí từ trải nghiệm thực tế. Bản demo lưu dữ liệu trên trình duyệt của bạn.</p>
 <div class="tabs">${Object.entries(T).map(([k,v])=>`<button class="${k===tab?'on':''}" data-a="tab" data-id="${k}">${v[0]}</button>`).join('')}</div>
 <form class="card" data-f="${f}"><h2>${t}</h2>${tab==='g'?'<p class="mut">Khách xem kho tư liệu chung và chỉ sửa hoặc xóa nội dung do chính mình gửi.</p>':(reg?fld('name','Họ và tên','text','required'):'')+fld('email','Email','email','required')+fld('pw','Mật khẩu','password','required minlength="4"')}
 <input type="hidden" name="role" value="${tab[0]==='t'?'teacher':'student'}"><p class="err">${esc(msg)}</p><button class="btn p">${tab==='g'?'Tiếp tục với tư cách khách':t}</button></form></div>`}

function shell(u,body){return `<div class="app"><nav><h2 class="brand">GeoFolio</h2><p class="brand" style="font-size:13px;opacity:.8">${esc(u.name)} · ${u.role==='teacher'?'Giáo viên':u.role==='student'?'Học sinh':'Khách'}</p>${NAV[u.role].map(n=>`<button class="${n[0]===view?'on':''}" data-a="view" data-id="${n[0]}">${n[1]} ${n[2]}</button>`).join('')}<button data-a="out">⎋ Đăng xuất</button></nav><main>${body}</main></div>`}

function tasksHtml(u){
 const ts=myClasses(u).flatMap(c=>db.tasks.filter(t=>t.cid===c.id).map(t=>({...t,cn:c.name})));
 return `<div class="card"><h3>Nhiệm vụ được giao</h3>${ts.map(t=>{const s=db.subs.find(s=>s.tid===t.id&&s.uid===u.id);return `<div><b>${esc(t.title)}</b> <span class="tag">${esc(t.type)}</span> <span class="mut">${esc(t.cn)}, hạn ${esc(t.due)}</span>${s?`<p class="mut">Đã nộp: ${esc(s.note)} ${s.r?'· Điểm '+s.score+'/10':'· Chờ đánh giá'}</p>`:`<form data-f="submit"><input type="hidden" name="tid" value="${t.id}"><input name="note" placeholder="Ghi chú hoặc liên kết bài nộp" required><button class="btn">Nộp bài</button></form>`}</div><hr>`}).join('')||empty('Chưa có nhiệm vụ. Hãy tham gia lớp bằng mã giáo viên cung cấp.')}</div>`}

const V={
home(u){const p=mine('projects',u),av=p.length?Math.round(p.reduce((a,x)=>a+ +x.progress,0)/p.length):0,r=rubAvg(u);
 return `<h1>Chào ${esc(u.name)}!</h1><p class="mut">Mỗi chuyến đi, mỗi bản đồ và mỗi ý tưởng đều tạo nên năng lực Địa lí của bạn.</p>
 <div class="grid">${[['Sản phẩm đã lưu',mine('items',u).length],['Điểm dừng thực địa',mine('stops',u).length],['Dự án',p.length],['Tiến độ dự án',av+'%']].map(x=>`<div class="card"><div class="mut">${x[0]}</div><div class="big">${x[1]}</div></div>`).join('')}</div>
 <form class="card" data-f="join"><h3>Tham gia lớp học</h3>${fld('code','Mã lớp do giáo viên cung cấp','text','required')}<button class="btn p">Tham gia lớp</button> <span class="err">${esc(msg)}</span><p class="mut">Lớp đã tham gia: ${myClasses(u).map(c=>esc(c.name)).join(', ')||'chưa có'}</p></form>
 <div class="card"><h3>Tiến độ phát triển năng lực</h3>${['Nhận thức khoa học Địa lí','Tìm hiểu Địa lí','Vận dụng kiến thức, kĩ năng','Năng lực số & hợp tác'].map((n,i)=>`<div>${n}: <b>${Math.round(r[i])}%</b></div><div class="bar"><i style="width:${r[i]}%"></i></div>`).join('')}<p class="mut">Tính từ rubric của các bài đã được giáo viên đánh giá.</p></div>${tasksHtml(u)}`},
port(u){return `<h1>Hồ sơ năng lực</h1><form class="card" data-f="item"><h3>Thêm sản phẩm</h3>${fld('title','Tên sản phẩm','text','required')}${sel('type','Loại',['Bản đồ số','Biểu đồ – số liệu','Báo cáo nghiên cứu','Bài giảng điện tử','Ảnh / tư liệu thực địa','Sản phẩm khác'])}<label>Mô tả<textarea name="desc"></textarea></label><button class="btn p">Lưu vào E-Portfolio</button></form>
 ${mine('items',u).map(i=>`<div class="card"><span class="tag">${esc(i.type)}</span> <b>${esc(i.title)}</b> <span class="mut">${i.date}</span><p>${esc(i.desc)}</p>${delBtn('items',i.id)}</div>`).join('')||empty('Chưa có sản phẩm nào.')}`},
field(u){return `<h1>Nhật ký thực địa số</h1><form class="card" data-f="stop"><h3>Tạo điểm dừng khảo sát</h3>${fld('title','Tên điểm dừng','text','required')}${sel('cat','Nhóm',['Địa hình – địa mạo','Khí hậu – thủy văn','Thổ nhưỡng – sinh vật','Dân cư – kinh tế','Môi trường','Khác'])}<div class="grid">${fld('lat','Vĩ độ','number','step="any"')}${fld('lng','Kinh độ','number','step="any"')}</div><button type="button" class="btn" data-a="gps">⌖ Lấy tọa độ GPS</button> <span class="mut" id="gpsmsg">Cần cấp quyền vị trí; nếu không được, hãy nhập tay.</span><label>Ghi chú quan sát<textarea name="note"></textarea></label><button class="btn p">Lưu điểm dừng</button></form>
 <h3>Các điểm dừng đã ghi nhận (${mine('stops',u).length})</h3>${mine('stops',u).map(s=>`<div class="card"><span class="tag">${esc(s.cat)}</span> <b>${esc(s.title)}</b> <span class="mut">${s.date}</span><p>${esc(s.note)}</p>${s.lat&&s.lng?`<a href="https://www.google.com/maps?q=${encodeURIComponent(s.lat+','+s.lng)}" target="_blank" rel="noopener">Mở ${esc(s.lat)}, ${esc(s.lng)} trên Google Maps</a> `:''}${delBtn('stops',s.id)}</div>`).join('')||empty('Chưa có điểm dừng.')}`},
proj(u){return `<h1>Dự án học tập</h1><form class="card" data-f="proj"><h3>Tạo dự án</h3>${fld('title','Tên dự án','text','required')}${fld('due','Hạn hoàn thành','date')}<label>Mô tả<textarea name="desc"></textarea></label><button class="btn p">Tạo dự án</button></form>
 ${mine('projects',u).map(p=>`<div class="card"><b>${esc(p.title)}</b> <span class="mut">hạn ${esc(p.due)||'chưa đặt'}</span><p>${esc(p.desc)}</p><label>Tiến độ: ${p.progress}%<input type="range" min="0" max="100" value="${p.progress}" data-a="prog" data-id="${p.id}"></label>${delBtn('projects',p.id)}</div>`).join('')||empty('Chưa có dự án.')}${tasksHtml(u)}`},
rub(u){const g=db.subs.filter(s=>s.uid===u.id&&s.r);return `<h1>Đánh giá & Rubric</h1><div class="card tw"><h3>Rubric sản phẩm thực hành Địa lí (4 mức)</h3><table><tr><th>Tiêu chí</th><th>Mức 1</th><th>Mức 2</th><th>Mức 3</th><th>Mức 4</th></tr>${CRIT.map((c,i)=>`<tr><td><b>${c}</b></td>${LV[i].map(l=>`<td>${l}</td>`).join('')}</tr>`).join('')}</table></div>
 <h3>Phản hồi của giáo viên</h3>${g.map(s=>{const t=db.tasks.find(t=>t.id===s.tid);return `<div class="card"><b>${esc(t?.title)}</b> · ${s.score}/10<p>${esc(s.fb)||'Chưa có nhận xét.'}</p><span class="mut">${esc(s.by)}, ${s.gd}</span></div>`}).join('')||empty('Chưa có bài nào được đánh giá.')}`},
comm(u){const e=db.pub.find(x=>x.id===editId)||{};return `<h1>Kho tư liệu cộng đồng</h1><form class="card" data-f="pub"><h3>${e.id?'Sửa tư liệu':'Gửi tư liệu mới'}</h3>${fld('title','Tiêu đề','text','required value="'+esc(e.title)+'"')}${fld('place','Địa điểm','text','value="'+esc(e.place)+'"')}<label>Nội dung<textarea name="desc" required>${esc(e.desc)}</textarea></label><button class="btn p">${e.id?'Cập nhật':'Gửi tư liệu'}</button></form>
 <p class="mut">Mọi người xem được tư liệu; chỉ chủ sở hữu mới sửa hoặc xóa được.</p>${db.pub.map(x=>`<div class="card"><b>${esc(x.title)}</b> <span class="tag">${esc(x.place)||'Không rõ nơi'}</span><p>${esc(x.desc)}</p><span class="mut">${esc(x.author)}, ${x.date}</span> ${x.owner===u.id?`<button class="btn" data-a="edit" data-id="${x.id}">Sửa</button> ${delBtn('pub',x.id)}`:''}</div>`).join('')||empty('Chưa có tư liệu.')}`},
cls(u){const cs=db.classes.filter(c=>c.tid===u.id),ts=db.tasks.filter(t=>cs.some(c=>c.id===t.cid)),ss=db.subs.filter(s=>ts.some(t=>t.id===s.tid));
 return `<h1>Trung tâm điều hành lớp học</h1><div class="grid">${[['Lớp phụ trách',cs.length],['Học sinh',db.members.filter(m=>cs.some(c=>c.id===m.cid)).length],['Bài chờ đánh giá',ss.filter(s=>!s.r).length]].map(x=>`<div class="card"><div class="mut">${x[0]}</div><div class="big">${x[1]}</div></div>`).join('')}</div>
 <form class="card" data-f="cls"><h3>Tạo lớp và mã tham gia</h3>${fld('name','Tên lớp','text','required')}<button class="btn p">Tạo lớp học</button><p class="mut">Học sinh tạo tài khoản, đăng nhập rồi nhập mã lớp ở trang Tổng quan.</p></form>
 ${cs.map(c=>`<div class="card"><b>${esc(c.name)}</b> · Mã lớp: <span class="tag">${c.code}</span> · ${db.members.filter(m=>m.cid===c.id).length} học sinh</div>`).join('')}
 ${cs.length?`<form class="card" data-f="task"><h3>Giao nhiệm vụ học tập</h3><label>Lớp<select name="cid">${cs.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>${sel('type','Loại',['Bài thực hành','Nhật ký thực địa','Dự án nhóm','Bài tập bản đồ'])}${fld('title','Tiêu đề','text','required')}${fld('due','Hạn nộp','date','required')}<button class="btn p">Đăng nhiệm vụ</button></form>`:''}
 <div class="card"><h3>Theo dõi và đánh giá bài nộp</h3>${ss.map(s=>{const t=db.tasks.find(t=>t.id===s.tid),st=db.users.find(x=>x.id===s.uid);return `<form data-f="grade"><input type="hidden" name="sid" value="${s.id}"><b>${esc(st?.name)}</b>: ${esc(t.title)} <span class="tag">${s.r?'Đã chấm '+s.score+'/10':'Chờ đánh giá'}</span><p>${esc(s.note)}</p><div class="grid">${CRIT.map((c,i)=>`<label>${c}<select name="r${i}">${[1,2,3,4].map(n=>`<option ${s.r&&s.r[i]===n?'selected':''}>${n}</option>`).join('')}</select></label>`).join('')}</div><label>Nhận xét<textarea name="fb">${esc(s.fb)}</textarea></label><button class="btn p">Lưu đánh giá</button></form><hr>`}).join('')||empty('Chưa có bài nộp.')}</div>
 <div class="card"><h3>Báo cáo học tập</h3><button class="btn" data-a="csv">Xuất báo cáo CSV</button>${csv?`<textarea rows="6" readonly>${esc(csv)}</textarea>`:''}</div>`}
};


const ok=r=>{if(r.error)throw r.error;return r};
async function load(){
 const q=t=>{let b=sb.from(t).select('*');if(!['class_members','projects'].includes(t))b=b.order('created_at',{ascending:false});return b.then(r=>{if(r.error)console.error('Lỗi tải bảng '+t+': '+r.error.message);return r.data||[]})};
 const [pr,cl,mb,it,st,pj,tk,sm,pb]=await Promise.all(['profiles','classes','class_members','portfolio_items','field_stops','projects','tasks','submissions','community_items'].map(q));
 db={users:pr,
  classes:cl.map(c=>({id:c.id,tid:c.teacher_id,name:c.name,code:c.code})),
  members:mb.map(m=>({uid:m.student_id,cid:m.class_id})),
  items:it.map(x=>({id:x.id,uid:x.student_id,title:x.title,type:x.type,desc:x.description,date:d10(x.created_at)})),
  stops:st.map(x=>({id:x.id,uid:x.student_id,title:x.title,cat:x.category,lat:x.lat,lng:x.lng,note:x.note,date:d10(x.created_at)})),
  projects:pj.map(x=>({id:x.id,uid:x.student_id,title:x.title,desc:x.description,due:x.due,progress:x.progress})),
  tasks:tk.map(t=>({id:t.id,cid:t.class_id,type:t.type,title:t.title,due:t.due})),
  subs:sm.map(s=>({id:s.id,tid:s.task_id,uid:s.student_id,note:s.note,r:s.rubric,score:s.score,fb:s.feedback,by:'Giáo viên',gd:d10(s.graded_at)})),
  pub:pb.map(x=>({id:x.id,owner:x.owner_id,author:x.author,title:x.title,place:x.place,desc:x.description,date:d10(x.created_at)}))};
}
async function enter(role){
 cur=null;const {data:{session}}=await sb.auth.getSession();
 if(session){const u=session.user;if(u.is_anonymous)cur={id:u.id,name:'Khách',role:'guest'};else{const {data}=await sb.from('profiles').select('*').eq('id',u.id).maybeSingle();cur=data}}
 if(cur&&role&&cur.role!==role){await sb.auth.signOut();cur=null;msg='Tài khoản này không phải '+(role==='teacher'?'giáo viên':'học sinh')+'.'}
 if(cur){view='';msg='';await load()}
}
function draw(){const u=cur,a=$('#app');if(!u){a.innerHTML=auth();return}if(!V[view]||!NAV[u.role].some(n=>n[0]===view))view=NAV[u.role][0][0];a.innerHTML=shell(u,V[view](u))}
async function reg(d,role){const r=await sb.auth.signUp({email:d.email,password:d.pw,options:{data:{name:d.name,role}}});if(r.error)return msg=r.error.message;if(!r.data.session)return msg='Hãy mở email để xác nhận tài khoản, rồi đăng nhập.';await enter()}
const ins=(t,row)=>sb.from(t).insert(row).then(ok);
const H={
 trReg:d=>reg(d,'teacher'),srReg:d=>reg(d,'student'),
 async login(d){const r=await sb.auth.signInWithPassword({email:d.email,password:d.pw});if(r.error)return msg='Sai email hoặc mật khẩu.';await enter(d.role)},
 async guest(){ok(await sb.auth.signInAnonymously());await enter()},
 async join(d){const r=await sb.rpc('join_class',{p_code:d.code});if(r.error)msg=/mã lớp/.test(r.error.message)?'Không tìm thấy mã lớp.':r.error.message},
 item:d=>ins('portfolio_items',{title:d.title,type:d.type,description:d.desc}),
 stop:d=>ins('field_stops',{title:d.title,category:d.cat,lat:d.lat||null,lng:d.lng||null,note:d.note}),
 proj:d=>ins('projects',{title:d.title,description:d.desc,due:d.due||null}),
 submit:d=>ins('submissions',{task_id:d.tid,note:d.note}),
 async pub(d){const row={title:d.title,place:d.place,description:d.desc};if(editId){ok(await sb.from('community_items').update(row).eq('id',editId));editId=null}else await ins('community_items',{...row,author:cur.name})},
 cls:d=>ins('classes',{name:d.name}),
 task:d=>ins('tasks',{class_id:d.cid,type:d.type,title:d.title,due:d.due}),
 async grade(d){const r=[0,1,2,3].map(i=>+d['r'+i]);ok(await sb.from('submissions').update({rubric:r,score:(r.reduce((a,b)=>a+b)/4*2.5).toFixed(1),feedback:d.fb,graded_by:cur.id,graded_at:new Date().toISOString()}).eq('id',d.sid))}
};
const TBL={items:'portfolio_items',stops:'field_stops',projects:'projects',pub:'community_items'};
const A={
 tab:d=>{tab=d.id;msg='';draw()},view:d=>{view=d.id;msg='';editId=null;draw()},
 async out(){await sb.auth.signOut();cur=null;msg='';draw()},
 edit:d=>{editId=d.id;draw()},
 async del(d){try{ok(await sb.from(TBL[d.k]).delete().eq('id',d.id));await load()}catch(e){alert(e.message)}draw()},
 gps(){const m=$('#gpsmsg');if(!navigator.geolocation)return m.textContent='Trình duyệt không hỗ trợ GPS.';navigator.geolocation.getCurrentPosition(p=>{$('[name=lat]').value=p.coords.latitude.toFixed(6);$('[name=lng]').value=p.coords.longitude.toFixed(6);m.textContent='Đã lấy tọa độ.'},()=>m.textContent='Không lấy được vị trí, hãy nhập tay.')},
 csv(){const u=cur,rows=[['Lớp','Học sinh','Nhiệm vụ','Trạng thái','Điểm']];db.subs.forEach(s=>{const t=db.tasks.find(t=>t.id===s.tid),c=t&&db.classes.find(c=>c.id===t.cid);if(c&&c.tid===u.id)rows.push([c.name,db.users.find(x=>x.id===s.uid)?.name,t.title,s.r?'Đã chấm':'Chờ đánh giá',s.score||''])});csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');draw()}
};
document.addEventListener('submit',async e=>{e.preventDefault();const f=e.target;msg='';try{await H[f.dataset.f]?.(Object.fromEntries(new FormData(f)));if(cur)await load()}catch(x){msg=x.message||String(x);if(cur)alert(msg)}draw()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(b&&b.dataset.a!=='prog')A[b.dataset.a]?.(b.dataset)});
document.addEventListener('change',async e=>{if(e.target.dataset.a==='prog'){try{ok(await sb.from('projects').update({progress:+e.target.value}).eq('id',e.target.dataset.id));await load()}catch(x){alert(x.message)}draw()}});
$('#app').textContent='Đang tải…';
enter().then(draw,()=>{msg='Không kết nối được Supabase.';draw()});
