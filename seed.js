require('dotenv').config();
const mongoose=require('mongoose'),bcrypt=require('bcryptjs'),M=require('./models');
const PW='Circloset@123';
(async()=>{await mongoose.connect(process.env.MONGODB_URI||'mongodb://127.0.0.1:27017/circloset');
for(const k of Object.values(M))await k.deleteMany({});
const pw=await bcrypt.hash(PW,12),addr=(area)=>({house:'12',street:'Main Road',area,city:'Chennai',state:'Tamil Nadu',pin:'600040'});
const[admin,user,seller]=await M.User.create([
 {name:'Admin',email:'admin@circloset.com',password:pw,phone:'9000000001',address:addr('Anna Nagar'),role:'admin',identityStatus:'verified'},
 {name:'Priya Sharma',email:'user@circloset.com',password:pw,phone:'9000000002',address:addr('Velachery'),identityStatus:'verified'},
 {name:'Meera Iyer',email:'seller@circloset.com',password:pw,phone:'9000000003',address:addr('Adyar'),identityStatus:'verified'}]);
const P=(area,latitude,longitude)=>({address:area+' Metro Station (public pickup point)',area,city:'Chennai',latitude,longitude});
const base=[['Black Formal Blazer','Blazer','M','Zara','Black','Formal','RENT_AND_SELL',250,500,2500,6999,P('Anna Nagar',13.085,80.2101)],
['Emerald Silk Saree','Saree','Free','Fabindia','Green','Ethnic','RENT_AND_SELL',400,800,3800,11000,P('T. Nagar',13.0418,80.2341)],
['Sage Green Dress','Dress','S','H&M','Green','Party','RENT',300,600,null,4499,P('Adyar',13.0067,80.2575)],
['Navy Bandhgala','Jacket','L','Manyavar','Navy','Ethnic','SALE',null,0,3200,9500,P('Velachery',12.9791,80.2209)],
['White Cotton Shirt','Shirt','M','Uniqlo','White','Casual','RENT_AND_SELL',120,200,900,2299,P('Anna Nagar',13.085,80.2101)],
['Black Tailored Trousers','Trousers','M','Zara','Black','Formal','RENT_AND_SELL',150,300,1400,3499,P('Adyar',13.0067,80.2575)]];
const cl=await M.Clothing.create(base.map(b=>({owner:seller.id,name:b[0],category:b[1],size:b[2],brand:b[3],color:b[4],style:b[5],condition:'Excellent',description:'Well cared for, dry-cleaned before every handover.',listingType:b[6],rentalPrice:b[7]||undefined,securityDeposit:b[8],salePrice:b[9]||undefined,retailPrice:b[10],pickupLocation:b[11]})));
const d=n=>new Date(Date.now()+n*864e5),r=cl[0];
await M.Rental.create({renter:user.id,owner:seller.id,clothing:r.id,startDate:d(-9),endDate:d(-7),days:3,rentalPrice:250,securityDeposit:500,totalAmount:1250,commission:75,ownerEarnings:675,status:'returned',pickupLocation:r.pickupLocation});
await M.Rental.create({renter:user.id,owner:seller.id,clothing:cl[1].id,startDate:d(3),endDate:d(5),days:3,rentalPrice:400,securityDeposit:800,totalAmount:2000,commission:120,ownerEarnings:1080,pickupLocation:cl[1].pickupLocation});
await M.Clothing.updateOne({_id:r._id},{rentalCount:1});await M.Clothing.updateOne({_id:cl[1]._id},{rentalCount:1});
await M.Review.create({reviewer:user.id,clothing:r.id,rating:5,comment:'Fit perfectly for my farewell!'});
await M.Notification.create([{user:user.id,type:'rental',title:'Rental confirmed',message:'Emerald Silk Saree is yours. Pickup details are ready.'},{user:seller.id,type:'rental',title:'Item rented',message:'Priya Sharma rented Emerald Silk Saree.'}]);
console.log('Seeded. Logins (password '+PW+'): admin@circloset.com, user@circloset.com, seller@circloset.com');process.exit(0)})().catch(e=>{console.error(e);process.exit(1)});
