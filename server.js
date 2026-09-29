require('dotenv').config();
const express=require('express'),mongoose=require('mongoose'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),cookie=require('cookie-parser'),multer=require('multer'),path=require('path'),fs=require('fs'),crypto=require('crypto');
const{OAuth2Client}=require('google-auth-library'),M=require('./models'),pay=require('./services/payment');
const SECRET=process.env.JWT_SECRET;if(!SECRET||SECRET.length<16){console.error('Set JWT_SECRET (16+ chars) in .env');process.exit(1)}
const app=express(),ACT=['confirmed','picked_up'],gc=new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const uploadRoot=process.env.VERCEL?path.join('/tmp','circloset-uploads'):path.join(__dirname,'uploads');
let dbConnection;
const connectDb=()=>{if(!dbConnection)dbConnection=mongoose.connect(process.env.MONGODB_URI||'mongodb://127.0.0.1:27017/circloset').catch(e=>{dbConnection=undefined;throw e});return dbConnection};
app.use(express.json({limit:'100kb'}),cookie());
app.use('/api',(q,s,n)=>connectDb().then(()=>n()).catch(e=>{console.error('MongoDB connection failed:',e.message);bad(s,'Database unavailable.',503)}));
/* ---- helpers ---- */
const h=f=>(q,s,n)=>Promise.resolve(f(q,s,n)).catch(n),bad=(s,m,c=400)=>s.status(c).json({error:m});
const EXT={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','application/pdf':'.pdf'};
const mk=(sub,types,mb)=>multer({storage:multer.diskStorage({destination:(q,f,cb)=>{const d=path.join(uploadRoot,sub);fs.mkdirSync(d,{recursive:true});cb(null,d)},filename:(q,f,cb)=>cb(null,crypto.randomUUID()+EXT[f.mimetype])}),
limits:{fileSize:mb*1048576,files:6},fileFilter:(q,f,cb)=>types.includes(f.mimetype)?cb(null,true):cb(new Error('BAD_FILE'))});
const upId=mk('identity',['image/jpeg','image/png','application/pdf'],3),upImg=mk('clothing',['image/jpeg','image/png','image/webp'],4);
const rm=f=>f&&fs.unlink(f.path,()=>{});
const sign=(s,u)=>s.cookie('token',jwt.sign({id:u.id},SECRET,{expiresIn:'7d'}),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV=='production',maxAge:6048e5});
const auth=role=>h(async(q,s,n)=>{try{q.user=await M.User.findById(jwt.verify(q.cookies.token,SECRET).id)}catch(e){}
if(!q.user||!q.user.active)return bad(s,'Please sign in to continue.',401);if(role&&q.user.role!=role)return bad(s,'You don\'t have access to that.',403);n()});
const me=u=>({id:u.id,name:u.name,email:u.email,phone:u.phone,address:u.address,profileImage:u.profileImage,identityStatus:u.identityStatus,identityType:u.identityType,role:u.role}); // never returns identityFile
const note=(user,type,title,message)=>M.Notification.create({user,type,title,message});
const pub=(c,uid)=>{const o=c.toObject?c.toObject():c;if(!uid||String(o.owner._id||o.owner)!=String(uid)){o.pickupArea=o.pickupLocation&&{area:o.pickupLocation.area,city:o.pickupLocation.city};delete o.pickupLocation}return o}; // exact pickup hidden from non-owners
const sum=(a,f)=>a.reduce((t,x)=>t+(f(x)||0),0);
/* ---- auth ---- */
app.get('/api/config',(q,s)=>s.json({googleClientId:process.env.GOOGLE_CLIENT_ID||null}));
app.post('/api/auth/register',upId.single('identity'),h(async(q,s)=>{const b=q.body,a={house:b.house,street:b.street,area:b.area,city:b.city,state:b.state,pin:b.pin};
const e=(b.email||'').trim().toLowerCase(),err=(m)=>{rm(q.file);return bad(s,m)};
if((b.name||'').trim().length<2)return err('Please enter your full name.');if(!/^\S+@\S+\.\S+$/.test(e))return err('Please enter a valid email.');if(!/^[6-9]\d{9}$/.test(b.phone||''))return err('Enter a valid 10-digit mobile number.');
if((b.password||'').length<8)return err('Password must be at least 8 characters.');if(b.password!==b.confirmPassword)return err('Passwords do not match.');
if(Object.values(a).some(v=>!(v||'').trim())||!/^\d{6}$/.test(a.pin))return err('Please complete your address with a valid 6-digit PIN code.');
if(!['Aadhaar','Driving Licence','Passport','College ID','Other'].includes(b.identityType))return err('Please choose an identity type.');if(!q.file)return err('Please upload your identity document (JPG, PNG or PDF, up to 3 MB).');
if(await M.User.exists({email:e}))return err('An account with this email already exists.');
const u=await M.User.create({name:b.name.trim(),email:e,phone:b.phone,address:a,password:await bcrypt.hash(b.password,12),identityType:b.identityType,identityFile:q.file.filename});
await note(u.id,'registration','Welcome to CIRCLOSET','Your account is ready. Your ID is pending verification.');sign(s,u);s.status(201).json({user:me(u)})}));
app.post('/api/auth/login',h(async(q,s)=>{const u=await M.User.findOne({email:String(q.body.email||'').toLowerCase()});
if(!u||!u.password||!(await bcrypt.compare(String(q.body.password||''),u.password)))return bad(s,'Email or password is incorrect.',401);if(!u.active)return bad(s,'This account is suspended.',403);sign(s,u);s.json({user:me(u)})}));
app.post('/api/auth/google',h(async(q,s)=>{if(!process.env.GOOGLE_CLIENT_ID)return bad(s,'Google sign-in isn\'t configured on this server yet.',501);
const p=(await gc.verifyIdToken({idToken:q.body.credential,audience:process.env.GOOGLE_CLIENT_ID})).getPayload();
let u=await M.User.findOne({$or:[{googleId:p.sub},{email:p.email}]});if(!u){u=await M.User.create({name:p.name,email:p.email,googleId:p.sub,profileImage:p.picture});await note(u.id,'registration','Welcome to CIRCLOSET','Please add your phone, address and ID to finish setup.')}
else if(!u.googleId){u.googleId=p.sub;await u.save()}if(!u.active)return bad(s,'This account is suspended.',403);sign(s,u);s.json({user:me(u),needsProfile:!u.phone||!u.address||!u.address.city||!u.identityFile})}));
app.get('/api/auth/me',auth(),(q,s)=>s.json({user:me(q.user)}));
app.post('/api/auth/logout',(q,s)=>{s.clearCookie('token');s.json({ok:true})});
/* ---- users ---- */
app.get('/api/users/profile',auth(),(q,s)=>s.json({user:me(q.user)}));
app.put('/api/users/profile',auth(),upImg.single('profileImage'),h(async(q,s)=>{const b=q.body,u=q.user;if(b.name){if(b.name.trim().length<2)return bad(s,'Please enter a valid name.');u.name=b.name.trim()}
if(b.phone){if(!/^[6-9]\d{9}$/.test(b.phone))return bad(s,'Enter a valid 10-digit mobile number.');u.phone=b.phone}
for(const k of['house','street','area','city','state','pin'])if(b[k])u.address[k]=b[k];if(q.file)u.profileImage='/uploads/clothing/'+q.file.filename;await u.save();s.json({user:me(u)})}));
app.post('/api/users/identity',auth(),upId.single('identity'),h(async(q,s)=>{const u=q.user;if(u.identityStatus=='verified'){rm(q.file);return bad(s,'Your identity is already verified.')}if(!q.file)return bad(s,'Please choose a file.');
if(u.identityFile)fs.unlink(path.join(uploadRoot,'identity',u.identityFile),()=>{});u.identityFile=q.file.filename;u.identityType=q.body.identityType||u.identityType;u.identityStatus='pending';await u.save();s.json({user:me(u)})}));
app.get('/api/users/:id/identity',auth(),h(async(q,s)=>{if(q.user.role!='admin'&&q.user.id!=q.params.id)return bad(s,'You don\'t have access to that.',403);
const u=await M.User.findById(q.params.id);if(!u||!u.identityFile)return bad(s,'No document on file.',404);s.sendFile(path.join(uploadRoot,'identity',u.identityFile))}));
/* ---- clothing ---- */
app.use('/uploads/clothing',express.static(path.join(uploadRoot,'clothing'),{maxAge:'7d'})); // identity folder is NOT served
const optAuth=h(async(q,s,n)=>{try{q.user=await M.User.findById(jwt.verify(q.cookies.token,SECRET).id)}catch(e){}n()});
const parseCl=(b,files)=>{const t=b.listingType,d={name:(b.name||'').trim(),category:b.category,size:b.size,brand:b.brand,color:b.color,style:b.style,condition:b.condition,description:b.description,listingType:t,
pickupLocation:{address:b.pickupAddress,area:b.pickupArea,city:b.pickupCity,latitude:+b.latitude,longitude:+b.longitude}};
if(!d.name||!['RENT','SALE','RENT_AND_SELL'].includes(t))return{err:'Please add a name and choose Rent, Sell or Rent & Sell.'};
if(t!='SALE'){d.rentalPrice=+b.rentalPrice;d.securityDeposit=+b.securityDeposit||0;if(!(d.rentalPrice>=1))return{err:'Enter a rental price per day.'}}
if(t!='RENT'){d.salePrice=+b.salePrice;if(!(d.salePrice>=1))return{err:'Enter a sale price.'}}
const p=d.pickupLocation;if(!p.area||!p.city||!isFinite(p.latitude)||!isFinite(p.longitude)||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180)return{err:'Please add a pickup area, city and map coordinates.'};
if(b.retailPrice)d.retailPrice=+b.retailPrice;if(files&&files.length)d.images=files.map(f=>'/uploads/clothing/'+f.filename);return{d}};
app.get('/api/clothing',optAuth,h(async(q,s)=>{const x=q.query,f={status:{$ne:'unavailable'}},pg=Math.max(1,+x.page||1),lim=Math.min(50,+x.limit||20);
if(x.type=='RENT')f.listingType={$in:['RENT','RENT_AND_SELL']};else if(x.type=='SALE')f.listingType={$in:['SALE','RENT_AND_SELL']};else if(x.type=='RENT_AND_SELL')f.listingType='RENT_AND_SELL';
for(const k of['category','size','style','condition'])if(x[k])f[k]=x[k];
if(x.q){const r=new RegExp(String(x.q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');f.$or=['name','category','color','style','brand','description'].map(k=>({[k]:r}))}
if(x.minPrice||x.maxPrice){const pr={};if(x.minPrice)pr.$gte=+x.minPrice;if(x.maxPrice)pr.$lte=+x.maxPrice;f.$and=[{$or:[{rentalPrice:pr},{salePrice:pr}]}]}
const[items,total]=await Promise.all([M.Clothing.find(f).sort('-createdAt').skip((pg-1)*lim).limit(lim).populate('owner','name'),M.Clothing.countDocuments(f)]);
s.json({items:items.map(c=>pub(c,q.user&&q.user.id)),total,page:pg,pages:Math.ceil(total/lim)})}));
app.get('/api/clothing/:id',optAuth,h(async(q,s)=>{const c=await M.Clothing.findById(q.params.id).populate('owner','name');if(!c)return bad(s,'Item not found.',404);
const[ret,rev]=await Promise.all([M.Rental.countDocuments({clothing:c._id,status:'returned'}),M.Review.find({clothing:c._id}).limit(20)]);
const bk=await M.Rental.find({clothing:c._id,status:{$in:ACT},endDate:{$gte:new Date()}}).select('startDate endDate');
s.json({item:pub(c,q.user&&q.user.id),booked:bk,reviews:rev,rating:rev.length?+(sum(rev,r=>r.rating)/rev.length).toFixed(1):null,journey:{listed:c.createdAt,rented:c.rentalCount,returned:ret,sold:c.status=='sold'}})}));
app.post('/api/clothing',auth(),upImg.array('images',5),h(async(q,s)=>{const{d,err}=parseCl(q.body,q.files);if(err){(q.files||[]).forEach(rm);return bad(s,err)}
const c=await M.Clothing.create({...d,owner:q.user.id});s.status(201).json({item:c})}));
app.put('/api/clothing/:id',auth(),upImg.array('images',5),h(async(q,s)=>{const c=await M.Clothing.findById(q.params.id);if(!c||String(c.owner)!=q.user.id)return bad(s,'Item not found.',404);
const{d,err}=parseCl({...c.toObject(),...q.body,pickupArea:q.body.pickupArea??c.pickupLocation.area,pickupCity:q.body.pickupCity??c.pickupLocation.city,pickupAddress:q.body.pickupAddress??c.pickupLocation.address,latitude:q.body.latitude??c.pickupLocation.latitude,longitude:q.body.longitude??c.pickupLocation.longitude},q.files);
if(err)return bad(s,err);Object.assign(c,d);if(q.body.status&&['available','unavailable'].includes(q.body.status))c.status=q.body.status;await c.save();s.json({item:c})}));
app.delete('/api/clothing/:id',auth(),h(async(q,s)=>{const c=await M.Clothing.findById(q.params.id);if(!c||(String(c.owner)!=q.user.id&&q.user.role!='admin'))return bad(s,'Item not found.',404);
if(await M.Rental.exists({clothing:c._id,status:{$in:ACT}}))return bad(s,'This item has active rentals and can\'t be removed yet.',409);c.status='unavailable';await c.save();s.json({ok:true})}));
/* ---- rentals (backend enforces availability) ---- */
app.post('/api/rentals',auth(),h(async(q,s)=>{const{clothingId,startDate,endDate}=q.body,a=new Date(startDate),b=new Date(endDate),c=mongoose.isValidObjectId(clothingId)&&await M.Clothing.findById(clothingId);
if(!c||c.status!='available'||c.listingType=='SALE')return bad(s,'This item isn\'t available to rent.',409);if(String(c.owner)==q.user.id)return bad(s,'You can\'t rent your own item.');
if(isNaN(a)||isNaN(b)||b<a||a<new Date(new Date().toDateString()))return bad(s,'Please choose valid dates.');
const clash={clothing:c._id,status:{$in:ACT},startDate:{$lte:b},endDate:{$gte:a}};if(await M.Rental.exists(clash))return bad(s,'Those dates are already booked. Please pick different dates.',409);
const days=Math.round((b-a)/864e5)+1,rent=c.rentalPrice*days,total=rent+c.securityDeposit,sp=pay.split(rent),p=await pay.charge(total,q.user);if(!p.ok)return bad(s,'Payment failed. You were not charged.',402);
const r=await M.Rental.create({renter:q.user.id,owner:c.owner,clothing:c._id,startDate:a,endDate:b,days,rentalPrice:c.rentalPrice,securityDeposit:c.securityDeposit,totalAmount:total,commission:sp.commission,ownerEarnings:sp.earnings,paymentRef:p.ref,pickupLocation:c.pickupLocation});
if(await M.Rental.exists({...clash,_id:{$lt:r._id}})){await r.deleteOne();return bad(s,'Those dates were just booked by someone else.',409)} // race-condition guard
await M.Clothing.updateOne({_id:c._id},{$inc:{rentalCount:1}});
await Promise.all([note(c.owner,'rental','Item rented',`${q.user.name} rented ${c.name} (${days} day${days>1?'s':''}).`),note(q.user.id,'rental','Rental confirmed',`${c.name} is yours. Pickup details are ready.`)]);
s.status(201).json({rental:r,pickup:r.pickupLocation})}));
const inv=(x,u)=>[x.renter,x.owner,x.buyer,x.seller].some(i=>i&&String(i._id||i)==u.id)||u.role=='admin';
app.get('/api/rentals/my',auth(),h(async(q,s)=>{const f=q.query.as=='owner'?{owner:q.user.id}:{renter:q.user.id};s.json({rentals:await M.Rental.find(f).sort('-createdAt').limit(100).populate('clothing','name images category').populate('renter owner','name')})}));
app.get('/api/rentals/:id',auth(),h(async(q,s)=>{const r=mongoose.isValidObjectId(q.params.id)&&await M.Rental.findById(q.params.id).populate('clothing','name images').populate('renter owner','name');
if(!r||!inv(r,q.user))return bad(s,'Rental not found.',404);s.json({rental:r})}));
app.put('/api/rentals/:id/status',auth(),h(async(q,s)=>{const r=await M.Rental.findById(q.params.id);if(!r||!inv(r,q.user))return bad(s,'Rental not found.',404);const st=q.body.status,own=String(r.owner)==q.user.id;
const ok={picked_up:own&&r.status=='confirmed',returned:own&&r.status=='picked_up',cancelled:r.status=='confirmed'&&r.startDate>new Date()};if(!ok[st])return bad(s,'That status change isn\'t allowed.',409);
r.status=st;await r.save();const other=own?r.renter:r.owner;await note(other,'rental','Rental '+st.replace('_',' '),'A rental was updated to '+st.replace('_',' ')+'.');s.json({rental:r})}));
/* ---- orders ---- */
app.post('/api/orders',auth(),h(async(q,s)=>{if(!mongoose.isValidObjectId(q.body.clothingId))return bad(s,'Item not found.',404);
const c=await M.Clothing.findOneAndUpdate({_id:q.body.clothingId,status:'available',listingType:{$in:['SALE','RENT_AND_SELL']},owner:{$ne:q.user._id}},{status:'sold'}); // atomic: only one buyer wins
if(!c)return bad(s,'This item is no longer available to buy.',409);
const sp=pay.split(c.salePrice),p=await pay.charge(c.salePrice,q.user);if(!p.ok){await M.Clothing.updateOne({_id:c._id},{status:'available'});return bad(s,'Payment failed. You were not charged.',402)}
const o=await M.Order.create({buyer:q.user.id,seller:c.owner,clothing:c._id,salePrice:c.salePrice,commission:sp.commission,sellerEarnings:sp.earnings,paymentRef:p.ref,pickupLocation:c.pickupLocation});
await Promise.all([note(c.owner,'sale','Item sold',`${c.name} sold for ₹${c.salePrice}.`),note(q.user.id,'purchase','Purchase confirmed',`${c.name} is yours. Pickup details are ready.`)]);s.status(201).json({order:o,pickup:o.pickupLocation})}));
app.get('/api/orders/my',auth(),h(async(q,s)=>{const f=q.query.as=='seller'?{seller:q.user.id}:{buyer:q.user.id};s.json({orders:await M.Order.find(f).sort('-createdAt').limit(100).populate('clothing','name images').populate('seller buyer','name')})}));
app.get('/api/orders/:id',auth(),h(async(q,s)=>{const o=mongoose.isValidObjectId(q.params.id)&&await M.Order.findById(q.params.id).populate('clothing','name images').populate('seller buyer','name');if(!o||!inv(o,q.user))return bad(s,'Order not found.',404);s.json({order:o})}));
/* ---- reviews & notifications ---- */
app.post('/api/reviews',auth(),h(async(q,s)=>{const{clothingId,rating,comment}=q.body;if(!(rating>=1&&rating<=5))return bad(s,'Choose a rating from 1 to 5.');
const ok=await Promise.all([M.Rental.exists({clothing:clothingId,renter:q.user.id,status:'returned'}),M.Order.exists({clothing:clothingId,buyer:q.user.id})]);if(!ok[0]&&!ok[1])return bad(s,'You can review items you\'ve rented or bought.',403);
s.status(201).json({review:await M.Review.create({reviewer:q.user.id,clothing:clothingId,rating,comment:String(comment||'').slice(0,500)})})}));
app.get('/api/reviews/:clothingId',h(async(q,s)=>s.json({reviews:await M.Review.find({clothing:q.params.clothingId}).sort('-createdAt').limit(50).populate('reviewer','name')})));
app.get('/api/notifications',auth(),h(async(q,s)=>s.json({notifications:await M.Notification.find({user:q.user.id}).sort('-createdAt').limit(30),unread:await M.Notification.countDocuments({user:q.user.id,read:false})})));
app.put('/api/notifications/read',auth(),h(async(q,s)=>{await M.Notification.updateMany({user:q.user.id,read:false},{read:true});s.json({ok:true})}));
/* ---- dashboard (all numbers computed from the database) ---- */
app.get('/api/dashboard',auth(),h(async(q,s)=>{const u=q.user.id,[act,rented,pur,sold,listed,myR,myO,ownR,ownO]=await Promise.all([M.Rental.countDocuments({renter:u,status:{$in:ACT}}),M.Rental.countDocuments({owner:u}),M.Order.countDocuments({buyer:u}),M.Order.countDocuments({seller:u}),
M.Clothing.countDocuments({owner:u,status:{$ne:'unavailable'}}),M.Rental.find({renter:u}).populate('clothing','salePrice retailPrice'),M.Order.find({buyer:u}).populate('clothing','retailPrice'),M.Rental.find({owner:u}),M.Order.find({seller:u})]);
const saved=sum(myR,r=>Math.max(0,((r.clothing&&(r.clothing.retailPrice||r.clothing.salePrice*2))||0)-r.rentalPrice*r.days))+sum(myO,o=>Math.max(0,((o.clothing&&o.clothing.retailPrice)||0)-o.salePrice));
s.json({activity:{activeRentals:act,purchases:pur,itemsListed:listed,itemsSold:sold,itemsRented:rented},circular:{itemsReused:myR.length+myO.length,moneySaved:saved,itemsShared:await M.Clothing.countDocuments({owner:u,rentalCount:{$gt:0}}),occasionsSupported:myR.length,earned:sum(ownR,r=>r.ownerEarnings)+sum(ownO,o=>o.sellerEarnings)}})}));
app.get('/api/dashboard/listings',auth(),h(async(q,s)=>{const u=q.user.id,items=await M.Clothing.find({owner:u,status:{$ne:'unavailable'}}).sort('-createdAt'),[ownR,ownO]=await Promise.all([M.Rental.find({owner:u}),M.Order.find({seller:u})]);
s.json({stats:{active:items.filter(i=>i.status=='available').length,rented:ownR.length,sold:ownO.length,earnings:sum(ownR,r=>r.ownerEarnings)+sum(ownO,o=>o.sellerEarnings),pending:ownR.filter(r=>r.status=='confirmed').length},items})}));
app.get('/api/dashboard/impact',h(async(q,s)=>{const[r,o,c]=await Promise.all([M.Rental.countDocuments({status:{$ne:'cancelled'}}),M.Order.countDocuments(),M.Clothing.countDocuments({status:{$ne:'unavailable'}})]);
s.json({garmentsReused:r+o,rentalOccasions:r,avgReuse:c?+((r+o)/c).toFixed(2):0})}));
/* ---- admin ---- */
app.get('/api/admin/stats',auth('admin'),h(async(q,s)=>{const r=await Promise.all([M.User.countDocuments(),M.User.countDocuments({identityStatus:'verified'}),M.Clothing.countDocuments(),M.Clothing.countDocuments({listingType:{$in:['RENT','RENT_AND_SELL']}}),M.Clothing.countDocuments({listingType:{$in:['SALE','RENT_AND_SELL']}}),
M.Rental.countDocuments({status:'returned'}),M.Order.countDocuments(),M.Rental.countDocuments({status:{$in:ACT}}),M.Order.countDocuments({status:'confirmed'}),M.Rental.find({status:{$ne:'cancelled'}}).select('commission'),M.Order.find().select('commission')]);
s.json({users:r[0],verified:r[1],clothing:r[2],rentalListings:r[3],saleListings:r[4],completedRentals:r[5],completedSales:r[6],activePickups:r[7]+r[8],revenue:sum(r[9],x=>x.commission)+sum(r[10],x=>x.commission),garmentsReused:r[9].length+r[6],avgReuse:r[2]?+((r[9].length+r[6])/r[2]).toFixed(2):0})}));
app.get('/api/admin/users',auth('admin'),h(async(q,s)=>{const us=await M.User.find().select('-password -identityFile').sort('-createdAt').limit(50);
s.json({users:await Promise.all(us.map(async u=>({...u.toObject(),listings:await M.Clothing.countDocuments({owner:u._id}),rentals:await M.Rental.countDocuments({renter:u._id}),purchases:await M.Order.countDocuments({buyer:u._id})})))})}));
app.put('/api/admin/users/:id',auth('admin'),h(async(q,s)=>{const u=await M.User.findById(q.params.id);if(!u)return bad(s,'User not found.',404);const{identityStatus,active}=q.body;
if(['verified','rejected','pending'].includes(identityStatus)){u.identityStatus=identityStatus;if(identityStatus=='verified')await note(u.id,'identity','Identity verified','You\'re verified. Happy sharing!')}if(typeof active=='boolean'&&u.id!=q.user.id)u.active=active;await u.save();s.json({ok:true})}));
/* ---- static frontend + errors ---- */
app.use(express.static(path.join(__dirname,'public')));
app.use('/api',(q,s)=>bad(s,'Not found.',404));
app.get('*',(q,s)=>s.sendFile(path.join(__dirname,'public/index.html')));
app.use((e,q,s,n)=>{const C={LIMIT_FILE_SIZE:'That file is too large.',BAD_FILE:'Unsupported file type. Use JPG, PNG or WebP (PDF also allowed for ID).',LIMIT_UNEXPECTED_FILE:'Too many or unexpected files.'};
if(C[e.code]||C[e.message])return bad(s,C[e.code]||C[e.message]);if(e.code===11000)return bad(s,'An account with this email already exists.',409);if(e.name=='ValidationError'||e.name=='CastError')return bad(s,'Please check the details you entered.');
if(/token|audience/i.test(e.message||''))return bad(s,'Sign-in failed. Please try again.',401);console.error(e);bad(s,'Something went wrong. Please try again.',500)});
if(require.main===module)connectDb().then(()=>app.listen(process.env.PORT||3000,()=>console.log('CIRCLOSET API + app on http://localhost:'+(process.env.PORT||3000)))).catch(e=>{console.error('MongoDB connection failed:',e.message);process.exit(1)});
module.exports=app;
