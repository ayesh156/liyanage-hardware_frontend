/**
 * 🔐 Secret Cost Cipher Key Mapping
 * 1->A, 2->W, 3->D, 4->O, 5->B, 6->R, 7->U, 8->S, 9->I, 0->K
 */
export const COST_SECRET_CIPHER: Record<string, string> = {
  '1': 'A',
  '2': 'W',
  '3': 'D',
  '4': 'O',
  '5': 'B',
  '6': 'R',
  '7': 'U',
  '8': 'S',
  '9': 'I',
  '0': 'K',
};

/**
 * අගය Secret Cipher එකට හෝ සාමාන්‍ය මුදලට පරිවර්තනය කරන ප්‍රධාන ශ්‍රිතය
 * @param price අදාළ Cost Price එක
 * @param useCipher true නම් අකුරු පෙන්වයි, false නම් සාමාන්‍ය මුදල පෙන්වයි
 */
export function formatCostDisplay(
  price: number | string | undefined | null,
  useCipher: boolean = true
): string {
  if (price === undefined || price === null || price === '') return '—';

  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return '—';

  // සාමාන්‍ය මිල ආකාරය තෝරා ඇත්නම්
  if (!useCipher) {
    return num.toFixed(2);
  }

  // Secret Cipher ආකාරය: දශම තිත එලෙසම තබා ඉලක්කම් අකුරු බවට පත් කරයි
  // 🌟 Smart Cents Formatter: ශත අගයක් ඇත්නම් පමණක් දශම සහිතව ගනියි (උදා: 140.50 -> AWK.BK), නැතහොත් .KK සම්පූර්ණයෙන්ම ඉවත් කරයි (උදා: 140.00 -> AWK)
  const hasCents = num % 1 !== 0;
  const formatted = hasCents ? num.toFixed(2) : Math.round(num).toString();

  if (!useCipher) {
    return formatted;
  }

  return formatted
    .split('')
    .map((char) => COST_SECRET_CIPHER[char] || char)
    .join('');
}

// QuickCheckout.tsx හි import කර ඇති නම සඳහා alias export එකක්
export const encodeCostToSecretCode = (price: number | string | undefined | null): string => {
  return formatCostDisplay(price, true);
};