const TRANSIT_MODES = ["BUS", "RAIL", "SUBWAY", "TRAM", "FERRY"];

function cleanPlaceName(name, fallback) {
  if (!name || name === "unknown") return fallback;
  return name;
}

export function getLegInstruction(leg) {
  const from = cleanPlaceName(leg.from, "bulunduğunuz konum");
  const to = cleanPlaceName(leg.to, "hedef nokta");
  const minutes = `${Math.max(1, Math.round(leg.duration / 60))} dk`;

  if (leg.mode === "WALK") {
    return { title: `${to} noktasına yürüyün`, detail: `${minutes} yürüyüş` };
  }

  if (TRANSIT_MODES.includes(leg.mode)) {
    const line = leg.routeName ? `${leg.routeName} hattına ` : "";
    return { title: `${line}${from} durağından binin`, detail: `${to} durağında inin` };
  }

  if (leg.mode === "BICYCLE" || leg.mode === "BICYCLE_RENTAL") {
    return { title: `${to} noktasına bisikletle gidin`, detail: `${minutes} sürüş` };
  }

  if (leg.mode === "CAR") {
    return { title: `${to} noktasına araçla gidin`, detail: `${minutes} sürüş` };
  }

  return { title: `${from} noktasından başlayın`, detail: `${to} noktasına devam edin` };
}
