// app.json'daki statik yapılandırmayı alır, gizli anahtarları ortam değişkeninden enjekte eder.
// Expo CLI, bu dosya değerlendirilmeden önce .env dosyalarını process.env'e yükler.
// Anahtar için .env.example'ı kopyalayıp .env oluşturun — .env git'e girmez.
export default ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!googleMapsApiKey) {
    console.warn(
      "[app.config] GOOGLE_MAPS_API_KEY tanımlı değil — Android haritası boş görünecek. " +
        "Bkz. .env.example"
    );
  }

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: googleMapsApiKey },
      },
    },
  };
};
