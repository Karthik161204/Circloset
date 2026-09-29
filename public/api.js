/* Thin client for the CIRCLOSET REST API (cookie auth). */
const API=async(p,o={})=>{const f=o.body instanceof FormData,r=await fetch('/api'+p,{method:o.method||(o.body?'POST':'GET'),credentials:'same-origin',headers:o.body&&!f?{'Content-Type':'application/json'}:{},body:o.body&&!f?JSON.stringify(o.body):o.body}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d};
/* Coordinates always come from the backend (returned only to rental/order participants). */
function navigateToPickup(lat,lng){window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,'_blank','noopener')}
