
const DERIV_URL = "wss://ws.derivws.com/websockets/v3?app_id=1089";

let socket;
let currentSymbol = "R_100";
let lastDigit = null;
let previousPrice = null;
let priceHistory = [];
let signalHistory = [];

function connectDeriv() {
  socket = new WebSocket(DERIV_URL);

  socket.onopen = () => {
    console.log("Connected to Deriv");
    updateStatus("Live");
    socket.send(JSON.stringify({
      ticks: currentSymbol,
      subscribe: 1
    }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.msg_type === "tick") {
      analyzeTick(data.tick);
    }

    if (data.error) {
      console.error(data.error.message);
      updateStatus("Error: " + data.error.message);
    }
  };

  socket.onclose = () => {
    updateStatus("Reconnecting...");
    setTimeout(connectDeriv, 3000);
  };
}

function analyzeTick(tick) {
  const price = Number(tick.quote);
  const displayPrice = Number(tick.quote).toFixed(
    tick.pip_size ?? 2
  );
  const digit = Number(displayPrice.slice(-1));

  document.querySelectorAll("[data-price]").forEach(el => {
    el.textContent = displayPrice;
  });

  priceHistory.push(price);
  if (priceHistory.length > 100) priceHistory.shift();

  const riseFall = previousPrice === null
    ? "WAIT"
    : price > previousPrice ? "RISE"
    : price < previousPrice ? "FALL" : "WAIT";

  const evenOdd = digit % 2 === 0 ? "EVEN" : "ODD";
  const overUnder = digit > 4 ? "OVER 4" : "UNDER 5";
  const matchesDiffers = lastDigit === null
    ? "WAIT"
    : digit === lastDigit ? "MATCHES" : "DIFFERS";

  const signals = {
    riseFall,
    evenOdd,
    overUnder,
    matchesDiffers
  };

  Object.entries(signals).forEach(([key, value]) => {
    document.querySelectorAll(`[data-signal="${key}"]`)
      .forEach(el => el.textContent = value);
  });

  if (previousPrice !== null) {
    signalHistory.unshift({
      time: new Date().toLocaleTimeString(),
      market: currentSymbol,
      ...signals
    });
    signalHistory = signalHistory.slice(0, 30);
    renderHistory();
  }

  previousPrice = price;
  lastDigit = digit;
}

function renderHistory() {
  const container = document.getElementById("signal-history");
  if (!container) return;

  container.replaceChildren();

  signalHistory.slice(0, 10).forEach(item => {
    const row = document.createElement("div");
    row.className = "history-item";
    row.textContent =
      `${item.time} | ${item.market} | ${item.riseFall} | ${item.evenOdd}`;
    container.appendChild(row);
  });
}

function updateStatus(message) {
  document.querySelectorAll("[data-status]").forEach(el => {
    el.textContent = message;
  });
}

function changeMarket(symbol) {
  if (!symbol) return;

  currentSymbol = symbol;
  previousPrice = null;
  lastDigit = null;
  priceHistory = [];

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
  } else {
    connectDeriv();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const marketSelect = document.getElementById("market-select");

  if (marketSelect) {
    currentSymbol = marketSelect.value || currentSymbol;
    marketSelect.addEventListener("change", e => {
      changeMarket(e.target.value);
    });
  }

  connectDeriv();
});
