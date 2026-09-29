// Payment abstraction. Mock by default (no card data is ever handled).
// To go live, implement the PAYMENT_KEY branch with Razorpay/Stripe and keep the same return shape.
const crypto=require('crypto');
const COMMISSION=+(process.env.COMMISSION_PCT||10)/100;
exports.split=amount=>{const commission=Math.round(amount*COMMISSION);return{commission,earnings:amount-commission}};
exports.charge=async(amount,user)=>{
  if(process.env.PAYMENT_KEY&&process.env.PAYMENT_SECRET){/* TODO: call payment gateway here */}
  return{ok:true,ref:'MOCK-'+crypto.randomBytes(5).toString('hex')};
};
