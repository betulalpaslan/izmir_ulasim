export function getTimeContext(simdi = new Date()) {
  const hour = simdi.getHours();
  const day = simdi.getDay();
  const isWeekend = day === 0 || day === 6;
  const isNight = hour < 6 || hour >= 23;
  const isRush = !isWeekend && ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19));
  const isPeak = !isWeekend && hour >= 10 && hour <= 16;
  if (isWeekend && hour >= 8 && hour <= 18) return "Hafta sonu - bisiklet güzel bir seçim!";
  if (isWeekend) return "Hafta sonu gece - seferler seyrek, sürelere dikkat edin.";
  if (isRush) return "Yoğun saat - metro aktarmasız en hızlı seçenek olabilir.";
  if (isNight) return "Gece saati - bazı hatlar çalışmıyor olabilir.";
  if (isPeak) return "Gündüz - tüm hatlar aktif, iyi yolculuklar!";
  return "";
}
