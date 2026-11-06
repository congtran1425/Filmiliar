import policyDocument from '../../../server/src/content/filmiliar-policy.json';
const pickupAddress = policyDocument.contact.address;

export const filmiliarContact = {
  name: policyDocument.contact.name,
  phone: policyDocument.contact.phone,
  phoneHref: 'tel:+84399798259',
  email: policyDocument.contact.email,
  hours: policyDocument.contact.hours,
  address: pickupAddress,
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupAddress)}`,
} as const;

export const filmiliarCopyright = policyDocument.copyright;
export const filmiliarPolicy = policyDocument;
