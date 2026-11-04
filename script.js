const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const today = new Date().toISOString().slice(0, 10);

const resourceCatalog = [
  {
    id: "RR-01",
    name: "Individual Reading Room",
    type: "Reading room",
    icon: "▤",
    capacity: "1 person",
    description: "A quiet enclosed room for focused individual study.",
    color: "#edf3fb",
    slots: 6
  },
  {
    id: "GR-02",
    name: "Group Discussion Room",
    type: "Discussion room",
    icon: "▥",
    capacity: "4–6 people",
    description: "A collaborative space for group projects and discussions.",
    color: "#f3effa",
    slots: 3
  },
  {
    id: "PC-04",
    name: "Computer Workstation",
    type: "Equipment",
    icon: "▣",
    capacity: "1 person",
    description: "A desktop workstation for research and academic work.",
    color: "#eaf4ec",
    slots: 12
  },
  {
    id: "PR-08",
    name: "Printing Station",
    type: "Equipment",
    icon: "▧",
    capacity: "Shared facility",
    description: "Reserve a time window to use the library printing station.",
    color: "#fff1e9",
    slots: 4
  },
  {
    id: "SC-03",
    name: "Study Cubicle",
    type: "Study space",
    icon: "▦",
    capacity: "1 person",
    description: "A semi-private cubicle for distraction-free study.",
    color: "#edf5f5",
    slots: 8
  },
  {
    id: "AV-02",
    name: "AV Learning Pod",
    type: "Equipment",
    icon: "▷",
    capacity: "1–2 people",
    description: "A multimedia pod for recorded lectures and learning content.",
    color: "#f8f1e7",
    slots: 2
  }
];

let student = JSON.parse(localStorage.getItem("lsStudent") || "null");
let bookings = JSON.parse(localStorage.getItem("lsBookings") || "[]");
let notifications = JSON.parse(localStorage.getItem("lsNotifications") || "[]");
let occupied = JSON.parse(localStorage.getItem("lsOccupied") || "{}");

let selectedSeat = null;
let activeFilter = "all";

const seatIds = Array.from(
  { length: 24 },
  (_, i) => `S${String(i + 1).padStart(2, "0")}`
);

const getKey = (floor, zone, date, slot, seat) =>
  [floor, zone, date, slot, seat].join("|");

const save = () => {
  localStorage.setItem("lsBookings", JSON.stringify(bookings));
  localStorage.setItem("lsNotifications", JSON.stringify(notifications));
  localStorage.setItem("lsOccupied", JSON.stringify(occupied));
};

const active = (b) =>
  b.status === "Confirmed" &&
  (b.date > today || (b.date === today && !isSlotPast(b.slot)));

function isSlotPast(slot) {
  const end = slot.split(" - ")[1];
  return new Date(`${today}T${end}:00`) < new Date();
}

// AUTOMATIC BOOKING EXPIRY

function expireBookings() {
  let changed = false;

  bookings.forEach(b => {
    if (
      b.status === "Confirmed" &&
      (b.date < today || (b.date === today && isSlotPast(b.slot)))
    ) {
      b.status = "Expired";
      changed = true;
    }
  });

  if (changed) {
    save();
    addNotification(
      "Booking expired",
      "Your reservation time has ended. The seat is available again."
    );
  }
}

// NOTIFICATIONS

function addNotification(title, message) {
  notifications.unshift({
    id: Date.now() + Math.random(),
    title,
    message,
    at: new Date().toLocaleString()
  });

  notifications = notifications.slice(0, 15);

  save();
  renderNotifications();
}

// TOAST MESSAGE

function toast(msg) {
  const el = document.createElement("div");

  el.className = "toast";
  el.textContent = msg;

  $("#toastContainer").append(el);

  setTimeout(() => el.remove(), 3200);
}

// INITIALIZE WEBSITE

function init() {
  $("#dateSelect").min = today;
  $("#dateSelect").value = today;

  if (!student) {
    $("#loginModal").classList.add("show");
  } else {
    applyStudent();
  }

  renderAll();
  renderNotifications();

  setInterval(() => {
    expireBookings();
    renderAll();
  }, 30000);
}

// STUDENT LOGIN

function applyStudent() {
  const name = student.name || "Student User";
  const id = student.id || "Student account";
  const initial = name.trim()[0].toUpperCase();

  $("#miniName").textContent = name;
  $("#topName").textContent = name;
  $("#miniId").textContent = id;

  $("#miniAvatar").textContent = initial;
  $("#topAvatar").textContent = initial;
}

$("#loginForm").addEventListener("submit", e => {
  e.preventDefault();

  student = {
    name: $("#studentName").value.trim(),
    id: $("#studentId").value.trim()
  };

  localStorage.setItem("lsStudent", JSON.stringify(student));

  $("#loginModal").classList.remove("show");

  applyStudent();

  toast(`Welcome, ${student.name}!`);
});

$("#logoutBtn").addEventListener("click", () => {
  student = null;

  localStorage.removeItem("lsStudent");

  $("#loginModal").classList.add("show");
});

// PAGE NAVIGATION

function go(page) {
  $$(".page").forEach(p => p.classList.remove("active"));

  $(`#page-${page}`).classList.add("active");

  $$(".nav-link").forEach(a => {
    a.classList.toggle("active", a.dataset.page === page);
  });

  $("#crumb").textContent = ({
    home: "Overview",
    book: "Book a Seat",
    resources: "Resources",
    mybookings: "My Bookings",
    history: "Booking History",
    admin: "Admin Dashboard"
  })[page];

  $("#sidebar").classList.remove("open");

  renderAll();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

$$("[data-page]").forEach(a => {
  a.addEventListener("click", e => {
    e.preventDefault();
    go(a.dataset.page);
  });
});

$$("[data-goto]").forEach(a => {
  a.addEventListener("click", e => {
    e.preventDefault();
    go(a.dataset.goto);
  });
});

$("#menuBtn").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

// SEAT MAP FILTERS

["floorSelect", "zoneSelect", "dateSelect", "slotSelect"].forEach(id => {
  $("#" + id).addEventListener("change", () => {
    selectedSeat = null;

    $("#selectedSeatLabel").textContent = "None selected";
    $("#confirmSeatBtn").disabled = true;

    renderSeatMap();
  });
});

// DISPLAY SEAT MAP

function renderSeatMap() {
  const floor = $("#floorSelect").value;
  const zone = $("#zoneSelect").value;
  const date = $("#dateSelect").value;
  const slot = $("#slotSelect").value;

  $("#mapSubtitle").textContent = `${floor} · ${zone}`;

  const grid = $("#seatGrid");
  grid.innerHTML = "";

  let available = 0;

  seatIds.forEach(seat => {
    const booked = bookings.some(b =>
      b.kind === "seat" &&
      b.floor === floor &&
      b.zone === zone &&
      b.date === date &&
      b.slot === slot &&
      b.seat === seat &&
      b.status === "Confirmed"
    );

    const isOccupied = !!occupied[`${floor}|${zone}|${seat}`];

    const btn = document.createElement("button");

    btn.className = "seat";
    btn.textContent = seat;
    btn.type = "button";

    if (booked) {
      btn.classList.add("booked");
      btn.disabled = true;
      btn.title = "Already booked";
    }

    else if (isOccupied) {
      btn.classList.add("occupied");
      btn.disabled = true;
      btn.title = "Temporarily unavailable";
    }

    else {
      available++;

      if (selectedSeat === seat) {
        btn.classList.add("selected");
      }

      btn.addEventListener("click", () => {
        selectedSeat = seat;

        $("#selectedSeatLabel").textContent = seat;
        $("#confirmSeatBtn").disabled = false;

        renderSeatMap();
      });
    }

    grid.append(btn);
  });

  $("#seatCount").textContent = `${available} of 24 available`;
}

// CONFIRM SEAT BOOKING

$("#confirmSeatBtn").addEventListener("click", () => {
  if (!selectedSeat) return;

  const floor = $("#floorSelect").value;
  const zone = $("#zoneSelect").value;
  const date = $("#dateSelect").value;
  const slot = $("#slotSelect").value;

  if (date < today) {
    toast("Please select a future date.");
    return;
  }

  const key = [floor, zone, date, slot, selectedSeat].join("|");

  const alreadyBooked = bookings.some(b =>
    b.kind === "seat" &&
    [b.floor, b.zone, b.date, b.slot, b.seat].join("|") === key &&
    b.status === "Confirmed"
  );

  if (alreadyBooked) {
    toast("That seat has just been booked. Choose another.");
    renderSeatMap();
    return;
  }

  const booking = {
    id: "LS" + Date.now().toString().slice(-7),
    kind: "seat",
    resource: "Library seat",
    seat: selectedSeat,
    floor,
    zone,
    date,
    slot,
    status: "Confirmed",
    student: student.name,
    studentId: student.id,
    created: new Date().toISOString()
  };

  bookings.unshift(booking);

  save();

  addNotification(
    "Seat booking confirmed",
    `${selectedSeat} · ${floor} · ${date} · ${slot}`
  );

  selectedSeat = null;

  $("#selectedSeatLabel").textContent = "None selected";
  $("#confirmSeatBtn").disabled = true;

  renderAll();
  renderSeatMap();

  toast("Your seat has been reserved!");
});

// DISPLAY RESOURCES

function renderResources() {
  $("#resourceGrid").innerHTML = resourceCatalog.map(r => `
    <article class="resource-card">

      <div class="resource-art"
           style="background:${r.color};color:#527a60">
        ${r.icon}
      </div>

      <h3>${r.name}</h3>

      <p>${r.description}</p>

      <div class="resource-meta">
        <span>${r.capacity}</span>
        <span>${r.slots} units</span>
      </div>

      <button class="primary-btn" data-resource="${r.id}">
        Reserve resource →
      </button>

    </article>
  `).join("");

  $$("[data-resource]").forEach(b => {
    b.addEventListener("click", () => {
      openResource(b.dataset.resource);
    });
  });
}

// RESOURCE BOOKING WINDOW

function openResource(id) {
  const r = resourceCatalog.find(x => x.id === id);

  $("#detailContent").innerHTML = `
    <div class="eyebrow">RESOURCE RESERVATION</div>

    <h2>${r.name}</h2>

    <p>${r.description}</p>

    <p>
      <strong>Capacity:</strong> ${r.capacity}<br>
      <strong>Resource ID:</strong> ${r.id}
    </p>

    <label for="resourceDate">Booking date</label>
    <input type="date" id="resourceDate"
           min="${today}" value="${today}">

    <label for="resourceSlot">Time slot</label>
    <select id="resourceSlot">
      <option>09:00 - 11:00</option>
      <option>11:00 - 13:00</option>
      <option>13:00 - 15:00</option>
      <option>15:00 - 17:00</option>
      <option>17:00 - 19:00</option>
    </select>

    <button class="primary-btn" id="resourceConfirm">
      Confirm resource booking →
    </button>
  `;

  $("#detailModal").classList.add("show");

  $("#resourceConfirm").addEventListener("click", () => {
    const date = $("#resourceDate").value;
    const slot = $("#resourceSlot").value;

    if (!date || date < today) {
      toast("Choose a valid booking date.");
      return;
    }

    const already = bookings.filter(b =>
      b.kind === "resource" &&
      b.resourceId === r.id &&
      b.date === date &&
      b.slot === slot &&
      b.status === "Confirmed"
    ).length;

    if (already >= r.slots) {
      toast("This resource is fully booked for that slot.");
      return;
    }

    bookings.unshift({
      id: "LR" + Date.now().toString().slice(-7),
      kind: "resource",
      resource: r.name,
      resourceId: r.id,
      date,
      slot,
      status: "Confirmed",
      student: student.name,
      studentId: student.id,
      created: new Date().toISOString()
    });

    save();

    addNotification(
      "Resource booking confirmed",
      `${r.name} · ${date} · ${slot}`
    );

    $("#detailModal").classList.remove("show");

    renderAll();

    toast("Resource reserved successfully!");
  });
}

$("#closeDetail").addEventListener("click", () => {
  $("#detailModal").classList.remove("show");
});

$("#detailModal").addEventListener("click", e => {
  if (e.target === $("#detailModal")) {
    $("#detailModal").classList.remove("show");
  }
});

// MY BOOKINGS

function renderMyBookings() {
  const list = bookings
    .filter(b => b.studentId === student?.id && active(b))
    .filter(b =>
      activeFilter === "all" ||
      (activeFilter === "seat" ? b.kind === "seat" : b.kind === "resource")
    );

  $("#myBookingsList").innerHTML = list.length
    ? list.map(b => bookingCard(b)).join("")
    : `
      <div class="empty-state">
        <strong>No active bookings found</strong>
        Your reserved seats and resources will appear here.
      </div>
    `;

  $$(".cancel-booking").forEach(btn => {
    btn.addEventListener("click", () => {
      cancelBooking(btn.dataset.id);
    });
  });
}

function bookingCard(b) {
  const subtitle = b.kind === "seat"
    ? `${b.floor} · ${b.zone} · Seat ${b.seat}`
    : `Resource ID: ${b.resourceId}`;

  return `
    <div class="booking-item">

      <div class="booking-type-icon">
        ${b.kind === "seat" ? "▦" : "▤"}
      </div>

      <div class="booking-info">
        <strong>
          ${b.resource === "Library seat" ? "Seat " + b.seat : b.resource}
        </strong>

        <p>
          ${subtitle} · ${formatDate(b.date)} · ${prettySlot(b.slot)}
        </p>

        <p>Booking ID: ${b.id}</p>
      </div>

      <span class="booking-status">${b.status}</span>

      <button class="cancel-btn cancel-booking" data-id="${b.id}">
        Cancel
      </button>

    </div>
  `;
}

// CANCEL BOOKING

function cancelBooking(id) {
  const b = bookings.find(x => x.id === id);

  if (!b || b.status !== "Confirmed") return;

  b.status = "Cancelled";

  save();

  addNotification(
    "Booking cancelled",
    `${b.resource === "Library seat" ? "Seat " + b.seat : b.resource} has been cancelled.`
  );

  renderAll();

  toast("Booking cancelled.");
}

// BOOKING FILTERS

$$(".filter-chip").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".filter-chip").forEach(x => x.classList.remove("active"));

    btn.classList.add("active");

    activeFilter = btn.dataset.filter;

    renderMyBookings();
  });
});

// BOOKING HISTORY

function renderHistory() {
  const mine = bookings.filter(b => b.studentId === student?.id);

  $("#historyTable").innerHTML = mine.length
    ? mine.map(b => `
      <tr>
        <td>
          <strong>
            ${b.resource === "Library seat" ? "Seat " + b.seat : b.resource}
          </strong>
          <br>${b.id}
        </td>

        <td>${formatDate(b.date)}</td>

        <td>${prettySlot(b.slot)}</td>

        <td>
          <span class="booking-status ${b.status.toLowerCase()}">
            ${b.status}
          </span>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="4">No booking history yet.</td></tr>`;
}

// ADMIN DASHBOARD

function renderAdmin() {
  $("#adminTotal").textContent = bookings.length;

  $("#adminActive").textContent =
    bookings.filter(active).length;

  $("#adminClosed").textContent =
    bookings.filter(b => b.status !== "Confirmed").length;

  $("#adminTable").innerHTML = bookings.length
    ? bookings.map(b => `
      <tr>
        <td>
          <strong>${escapeHtml(b.student)}</strong>
          <br>${escapeHtml(b.studentId)}
        </td>

        <td>
          ${b.resource === "Library seat" ? "Seat " + b.seat : b.resource}
        </td>

        <td>${formatDate(b.date)}</td>

        <td>${prettySlot(b.slot)}</td>

        <td>
          <span class="booking-status ${b.status.toLowerCase()}">
            ${b.status}
          </span>
        </td>

        <td>
          ${
            b.status === "Confirmed"
              ? `<button class="cancel-btn admin-cancel" data-id="${b.id}">Cancel</button>`
              : "—"
          }
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="6">No reservations have been made.</td></tr>`;

  $$(".admin-cancel").forEach(btn => {
    btn.addEventListener("click", () => {
      cancelBooking(btn.dataset.id);
    });
  });

  $("#adminSeat").innerHTML = seatIds
    .map(s => `<option>${s}</option>`)
    .join("");
}

// ADMIN SEAT AVAILABILITY CONTROL

$("#adminFloor").addEventListener("change", renderAdmin);

$("#toggleSeatBtn").addEventListener("click", () => {
  const key = `${$("#adminFloor").value}|Silent Zone|${$("#adminSeat").value}`;

  occupied[key] = !occupied[key];

  save();
  renderAll();

  toast(
    occupied[key]
      ? "Seat marked occupied."
      : "Seat marked available."
  );
});

// EXPORT BOOKINGS AS CSV

$("#exportBtn").addEventListener("click", () => {
  const rows = [
    [
      "Booking ID",
      "Student",
      "Student ID",
      "Resource",
      "Date",
      "Time",
      "Status"
    ],
    ...bookings.map(b => [
      b.id,
      b.student,
      b.studentId,
      b.resource === "Library seat" ? `Seat ${b.seat}` : b.resource,
      b.date,
      b.slot,
      b.status
    ])
  ];

  const csv = rows
    .map(r =>
      r.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");

  const a = document.createElement("a");

  a.href = URL.createObjectURL(
    new Blob([csv], { type: "text/csv" })
  );

  a.download = "library-bookings.csv";
  a.click();

  URL.revokeObjectURL(a.href);
});

// NOTIFICATION DISPLAY

function renderNotifications() {
  $("#notificationList").innerHTML = notifications.length
    ? notifications.map(n => `
      <div class="notification-item">
        <strong>${escapeHtml(n.title)}</strong>
        ${escapeHtml(n.message)}
        <br>
        <small>${escapeHtml(n.at)}</small>
      </div>
    `).join("")
    : `<div class="notification-empty">You're all caught up.</div>`;
}

$("#notificationBtn").addEventListener("click", () => {
  $("#notificationPopover").classList.toggle("hidden");
});

$("#clearNotifications").addEventListener("click", () => {
  notifications = [];

  save();
  renderNotifications();
});

// HOME DASHBOARD STATISTICS

function renderHome() {
  const total = 72;

  const confirmed = bookings.filter(active).length;

  const available = Math.max(0, total - confirmed);

  $("#statAvailable").textContent = available;

  $("#statBooked").textContent = confirmed;

  $("#statMine").textContent =
    bookings.filter(b => b.studentId === student?.id && active(b)).length;

  $("#statResources").textContent = resourceCatalog.length;

  $("#bookingBadge").textContent =
    bookings.filter(b => b.studentId === student?.id && active(b)).length;

  const next = bookings
    .filter(b => b.studentId === student?.id && active(b))
    .sort((a, b) =>
      (a.date + a.slot).localeCompare(b.date + b.slot)
    )[0];

  $("#nextBooking").innerHTML = next
    ? bookingCard(next)
    : `
      No upcoming bookings yet.
      <a href="#book" data-goto="book">Book a seat</a> to get started.
    `;

  $$("#nextBooking [data-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      cancelBooking(btn.dataset.id);
    });
  });

  $$("#nextBooking [data-goto]").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      go(a.dataset.goto);
    });
  });
}

// UPDATE ALL WEBSITE SECTIONS

function renderAll() {
  expireBookings();

  renderHome();
  renderSeatMap();
  renderResources();
  renderMyBookings();
  renderHistory();
  renderAdmin();
}

// DATE FORMATTING

function formatDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function prettySlot(s) {
  return s.replace(" - ", " – ");
}

// BASIC HTML ESCAPING

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// START WEBSITE

init();