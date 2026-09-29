const m=require('mongoose'),S=m.Schema,oid=S.Types.ObjectId,T={timestamps:true};
const loc={address:String,area:String,city:String,latitude:Number,longitude:Number};
exports.User=m.model('User',new S({name:String,email:{type:String,unique:true,lowercase:true,trim:true},password:String,phone:String,
address:{house:String,street:String,area:String,city:String,state:String,pin:String},profileImage:String,identityType:String,identityFile:String,
identityStatus:{type:String,enum:['pending','verified','rejected'],default:'pending'},googleId:String,role:{type:String,enum:['user','admin'],default:'user'},active:{type:Boolean,default:true}},T));
exports.Clothing=m.model('Clothing',new S({owner:{type:oid,ref:'User',index:true},name:String,category:String,size:String,brand:String,color:String,style:String,condition:String,description:String,images:[String],
listingType:{type:String,enum:['RENT','SALE','RENT_AND_SELL'],required:true},rentalPrice:Number,securityDeposit:{type:Number,default:0},salePrice:Number,retailPrice:Number,pickupLocation:loc,
availability:{from:Date,to:Date},status:{type:String,enum:['available','sold','unavailable'],default:'available'},rentalCount:{type:Number,default:0}},T));
exports.Rental=m.model('Rental',new S({renter:{type:oid,ref:'User',index:true},owner:{type:oid,ref:'User',index:true},clothing:{type:oid,ref:'Clothing',index:true},startDate:Date,endDate:Date,days:Number,
rentalPrice:Number,securityDeposit:Number,totalAmount:Number,commission:Number,ownerEarnings:Number,paymentRef:String,status:{type:String,enum:['confirmed','picked_up','returned','cancelled'],default:'confirmed'},pickupLocation:loc},T));
exports.Order=m.model('Order',new S({buyer:{type:oid,ref:'User',index:true},seller:{type:oid,ref:'User',index:true},clothing:{type:oid,ref:'Clothing'},salePrice:Number,commission:Number,sellerEarnings:Number,paymentRef:String,
status:{type:String,enum:['confirmed','completed'],default:'confirmed'},pickupLocation:loc},T));
exports.Review=m.model('Review',new S({reviewer:{type:oid,ref:'User'},clothing:{type:oid,ref:'Clothing',index:true},rating:{type:Number,min:1,max:5},comment:String},T));
exports.Notification=m.model('Notification',new S({user:{type:oid,ref:'User',index:true},type:String,title:String,message:String,read:{type:Boolean,default:false}},T));
