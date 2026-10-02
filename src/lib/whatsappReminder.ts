// frontend/src/lib/whatsappReminder.ts
export const sendWhatsAppDueReminder = (
  phone: string,
  customerName: string,
  dueBalance: number,
  invoiceNumbers: string[] = []
): void => {
  // දුරකථන අංකය ශ්‍රී ලාංකික ආකෘතියට සකස් කිරීම (94xxxxxxxxx)
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '94' + cleanPhone.substring(1);
  } else if (!cleanPhone.startsWith('94') && cleanPhone.length === 9) {
    cleanPhone = '94' + cleanPhone;
  }

  const invoiceText = invoiceNumbers.length > 0 
    ? `Invoices: ${invoiceNumbers.join(', ')}` 
    : 'Pending invoice bills';

  // ලියනගේ හාඩ්වෙයාර් සඳහා Emoji රහිත වෘත්තීය පණිවිඩය
  const message = `Liyanage Hardware - Payment Reminder

Dear ${customerName},

This is a friendly reminder that you have an outstanding due balance of Rs. ${dueBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} for ${invoiceText}.

Kindly arrange the payment at your earliest convenience. If you have already made this settlement, please ignore this notice.

For inquiries, contact: 0773751805 / 0412268217
Location: Hakmana Road, Deiyandara`;

  const encodedUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(encodedUrl, '_blank');
};