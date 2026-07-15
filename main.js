console.log("Portal Architect loaded");

const commitFooter = document.getElementById("commitFooter");

function getCountFromResponse(response) {
    const linkHeader = response.headers.get("Link");

    if (linkHeader) {
        const match = linkHeader.match(/[?&]page=(\d+)>;\s*rel="last"/);
        if (match) {
            return Number(match[1]);
        }
    }

    if (response.ok) {
        // No Link header means there's only one page of results, i.e. one item.
        return 1;
    }

    return null;
}

let debugCommitStatus = null;
let debugDeployStatus = null;
let debugRateRemaining = null;

Promise.all([
    fetch("https://api.github.com/repos/Creator657/Portal-Architect/commits?per_page=1"),
    fetch("https://api.github.com/repos/Creator657/Portal-Architect/deployments?per_page=1")
])
    .then(function (responses) {
        const [commitsResponse, deploymentsResponse] = responses;

        debugCommitStatus = commitsResponse.status;
        debugDeployStatus = deploymentsResponse.status;
        debugRateRemaining = commitsResponse.headers.get("X-RateLimit-Remaining");

        if (!commitsResponse.ok || !deploymentsResponse.ok) {
            throw new Error("GitHub API request failed (status " + debugCommitStatus + "/" + debugDeployStatus + ")");
        }

        const commitCount = getCountFromResponse(commitsResponse);
        const deploymentCount = getCountFromResponse(deploymentsResponse);

        if (commitCount === null || deploymentCount === null) {
            throw new Error("Could not parse commit or deployment count");
        }

        const timestamp = Date.now().toString(36);
        commitFooter.textContent = "Debug ID: PA-" + timestamp +
            "-C" + commitCount +
            "-D" + deploymentCount +
            "-R" + (debugRateRemaining !== null ? debugRateRemaining : "NA");
        commitFooter.style.color = "#8a6fa8";
    })
    .catch(function (err) {
        const timestamp = Date.now().toString(36);
        const debugId = "PA-" + timestamp +
            "-C" + (debugCommitStatus !== null ? debugCommitStatus : "NA") +
            "-D" + (debugDeployStatus !== null ? debugDeployStatus : "NA") +
            "-R" + (debugRateRemaining !== null ? debugRateRemaining : "NA");

        commitFooter.textContent = "Unable to load repository stats. (Debug ID: " + debugId + ")";
        commitFooter.style.color = "#ff8a8a";

        console.error("Footer stats fetch failed.", {
            debugId: debugId,
            message: err.message,
            commitStatus: debugCommitStatus,
            deployStatus: debugDeployStatus,
            rateLimitRemaining: debugRateRemaining,
            timeISO: new Date().toISOString()
        });
    });

const button = document.getElementById("generateBtn");
const errorEl = document.getElementById("formError");
const noticeEl = document.getElementById("radiusNotice");

const mobileToggle = document.getElementById("mobileToggle");

mobileToggle.addEventListener("change", function () {
    document.body.classList.toggle("mobile-mode", mobileToggle.checked);
});

function showError(message) {
    errorEl.textContent = message;
}

function showNotice(message) {
    noticeEl.textContent = message;
}

const radiusField = document.getElementById("radius");

radiusField.addEventListener("input", function () {
    const rawValue = radiusField.value.trim();

    if (rawValue === "") {
        noticeEl.textContent = "";
        return;
    }

    const numericValue = Number(rawValue);

    if (Number.isNaN(numericValue)) {
        noticeEl.textContent = "";
        return;
    }

    const truncated = Math.trunc(numericValue);

    if (truncated !== numericValue) {
        showNotice("Rounding radius to " + truncated + ".");
    } else {
        noticeEl.textContent = "";
    }
});

// --- Shared grid math -------------------------------------------------
// These mirror the exact math used when the grid is generated, so every
// tool below (search, nearest-portal, slot finder) stays consistent with
// what's actually drawn on screen.

function getPortalName(x, z) {
    if (x === 0 && z === 0) {
        return "★★★";
    }
    let name = "";
    if (z > 0) name += "N" + z;
    if (z < 0) name += "S" + Math.abs(z);
    if (x > 0) name += "E" + x;
    if (x < 0) name += "W" + Math.abs(x);
    return name;
}

// The Mother Portal's anchor point. Set every time Generate Grid succeeds.
// Tools that need to measure against the grid (nearest portal, slot finder)
// read from here instead of recalculating, since only the Mother Portal
// has an "exact" Overworld coordinate — everything else is derived from it.
let motherAnchor = null; // { netherX, netherZ, overworldX, overworldZ, radius }

// Given any Overworld X/Z, find the closest point in the portal lattice,
// even if that point falls outside the currently generated radius.
function findNearestLatticePoint(targetOverworldX, targetOverworldZ) {
    const targetNetherX = targetOverworldX / 8;
    const targetNetherZ = targetOverworldZ / 8;

    const x = Math.round((targetNetherX - motherAnchor.netherX) / 35);
    const z = Math.round((targetNetherZ - motherAnchor.netherZ) / 40);

    const portalNetherX = motherAnchor.netherX + x * 35;
    const portalNetherZ = motherAnchor.netherZ + z * 40;

    const isCenter = x === 0 && z === 0;
    const portalOverworldX = isCenter ? motherAnchor.overworldX : Math.round(portalNetherX * 8);
    const portalOverworldZ = isCenter ? motherAnchor.overworldZ : Math.round(portalNetherZ * 8);

    return {
        x: x,
        z: z,
        name: getPortalName(x, z),
        netherX: portalNetherX,
        netherZ: portalNetherZ,
        overworldX: portalOverworldX,
        overworldZ: portalOverworldZ
    };
}

function highlightCard(card) {
    card.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    card.classList.add("highlighted-portal");
    setTimeout(function () {
        card.classList.remove("highlighted-portal");
    }, 2200);
}

function findCardByName(name) {
    return Array.from(document.querySelectorAll(".portal-card")).find(function (card) {
        return card.dataset.portalName === name;
    }) || null;
}

function findCardByOffset(x, z) {
    return Array.from(document.querySelectorAll(".portal-card")).find(function (card) {
        return Number(card.dataset.x) === x && Number(card.dataset.z) === z;
    }) || null;
}

// --- Grid generation ----------------------------------------------------

button.addEventListener("click", function () {

    errorEl.textContent = "";
    noticeEl.textContent = "";

    const overworldXInput = document.getElementById("motherX").value.trim();
    const overworldZInput = document.getElementById("motherZ").value.trim();
    const radiusInput = document.getElementById("radius").value.trim();

    if (overworldXInput === "" || overworldZInput === "" || radiusInput === "") {
        showError("Please fill in Overworld X, Overworld Z, and Grid Radius.");
        return;
    }

    const overworldX = Number(overworldXInput);
    const overworldZ = Number(overworldZInput);
    let radius = Number(radiusInput);

    if (Number.isNaN(overworldX) || Number.isNaN(overworldZ) || Number.isNaN(radius)) {
        showError("Coordinates and radius must be numbers.");
        return;
    }

    const truncatedRadius = Math.trunc(radius);

    if (truncatedRadius !== radius) {
        showNotice("Rounding radius to " + truncatedRadius + ".");
    }

    radius = truncatedRadius;

    if (radius < 1) {
        showError("Grid radius must be at least 1.");
        return;
    }

    if (radius > 15) {
        showError("Maximum grid radius is 15 for performance.");
        return;
    }

    const netherX = Math.round(overworldX / 8);
    const netherZ = Math.round(overworldZ / 8);

    motherAnchor = {
        netherX: netherX,
        netherZ: netherZ,
        overworldX: overworldX,
        overworldZ: overworldZ,
        radius: radius
    };

    const results = document.getElementById("results");
    results.innerHTML = "";

    for (let z = radius; z >= -radius; z--) {

        const row = document.createElement("div");
        row.className = "portal-row";

        for (let x = -radius; x <= radius; x++) {

            const card = document.createElement("div");
            card.className = "portal-card";

            const isCenter = x === 0 && z === 0;
            const name = getPortalName(x, z);

            if (isCenter) {
                card.classList.add("mother-portal");
            }

            card.dataset.portalName = name;
            card.dataset.x = x;
            card.dataset.z = z;

            const portalNetherX = netherX + (x * 35);
            const portalNetherZ = netherZ + (z * 40);

            // The Mother Portal echoes back the exact Overworld coordinates you
            // typed in — it is never recalculated. Its Nether line still shows
            // the rounded value used to anchor the grid. Every other portal only
            // exists in Nether space, so its Overworld line is calculated back
            // (Nether x 8) since there's no original input to preserve for it.
            const portalOverworldX = isCenter ? overworldX : Math.round(portalNetherX * 8);
            const portalOverworldZ = isCenter ? overworldZ : Math.round(portalNetherZ * 8);

            card.innerHTML = `
<div class="portal-frame">

    <div class="portal-center">

        <div class="portal-name">
            ${name}
        </div>

        <div class="portal-coords">

            Over World
            <br>

            X: ${portalOverworldX}

            <br>

            Z: ${portalOverworldZ}

            <br><br>

            Nether
            <br>

            X: ${portalNetherX}

            <br>

            Z: ${portalNetherZ}

        </div>

        <button type="button" class="copy-btn">Copy</button>

    </div>

</div>
`;

            const copyBtn = card.querySelector(".copy-btn");
            copyBtn.addEventListener("click", function (event) {
                event.stopPropagation();
                const text = "Overworld " + portalOverworldX + ", " + portalOverworldZ +
                    " | Nether " + portalNetherX + ", " + portalNetherZ;

                navigator.clipboard.writeText(text)
                    .then(function () {
                        const original = copyBtn.textContent;
                        copyBtn.textContent = "Copied!";
                        setTimeout(function () {
                            copyBtn.textContent = original;
                        }, 1400);
                    })
                    .catch(function () {
                        copyBtn.textContent = "Failed";
                        setTimeout(function () {
                            copyBtn.textContent = "Copy";
                        }, 1400);
                    });
            });

            row.appendChild(card);
        }

        results.appendChild(row);
    }
});

// --- Tool 1: Search portal by name --------------------------------------

const searchNameInput = document.getElementById("searchNameInput");
const searchNameBtn = document.getElementById("searchNameBtn");
const searchStatus = document.getElementById("searchStatus");

searchNameBtn.addEventListener("click", function () {
    searchStatus.textContent = "";

    const query = searchNameInput.value.trim();

    if (query === "") {
        searchStatus.style.color = "#ff8a8a";
        searchStatus.textContent = "Type a portal name first, e.g. N3E2.";
        return;
    }

    const card = findCardByName(query);

    if (!card) {
        searchStatus.style.color = "#ff8a8a";
        searchStatus.textContent = "\"" + query + "\" isn't in the currently generated grid.";
        return;
    }

    highlightCard(card);
    searchStatus.style.color = "#8a6fa8";
    searchStatus.textContent = "Found " + query + ".";
});

// --- Tool 2: Highlight nearest portal (within the current grid) --------

const nearestXInput = document.getElementById("nearestX");
const nearestZInput = document.getElementById("nearestZ");
const nearestBtn = document.getElementById("nearestBtn");
const nearestStatus = document.getElementById("nearestStatus");

nearestBtn.addEventListener("click", function () {
    nearestStatus.textContent = "";

    if (motherAnchor === null) {
        nearestStatus.style.color = "#ff8a8a";
        nearestStatus.textContent = "Generate a grid first.";
        return;
    }

    const xVal = nearestXInput.value.trim();
    const zVal = nearestZInput.value.trim();

    if (xVal === "" || zVal === "") {
        nearestStatus.style.color = "#ff8a8a";
        nearestStatus.textContent = "Enter both an Overworld X and Z.";
        return;
    }

    const targetX = Number(xVal);
    const targetZ = Number(zVal);

    if (Number.isNaN(targetX) || Number.isNaN(targetZ)) {
        nearestStatus.style.color = "#ff8a8a";
        nearestStatus.textContent = "Coordinates must be numbers.";
        return;
    }

    const nearest = findNearestLatticePoint(targetX, targetZ);
    const card = findCardByOffset(nearest.x, nearest.z);

    if (card) {
        highlightCard(card);
        nearestStatus.style.color = "#8a6fa8";
        nearestStatus.textContent = "Nearest portal is " + nearest.name + ".";
        return;
    }

    nearestStatus.style.color = "#ffd54a";
    nearestStatus.textContent = "Nearest portal (" + nearest.name + ") isn't in the current grid — it would sit at Overworld " +
        nearest.overworldX + ", " + nearest.overworldZ + ". Try a larger radius.";
});

// --- Tool 3: Distance calculator (any two points) -----------------------

const distX1 = document.getElementById("distX1");
const distZ1 = document.getElementById("distZ1");
const distX2 = document.getElementById("distX2");
const distZ2 = document.getElementById("distZ2");
const distBtn = document.getElementById("distBtn");
const distStatus = document.getElementById("distStatus");
const distResult = document.getElementById("distResult");

distBtn.addEventListener("click", function () {
    distStatus.textContent = "";
    distResult.innerHTML = "";

    const rawValues = [distX1.value.trim(), distZ1.value.trim(), distX2.value.trim(), distZ2.value.trim()];

    if (rawValues.some(function (v) { return v === ""; })) {
        distStatus.style.color = "#ff8a8a";
        distStatus.textContent = "Fill in both points' X and Z.";
        return;
    }

    const numericValues = rawValues.map(Number);

    if (numericValues.some(Number.isNaN)) {
        distStatus.style.color = "#ff8a8a";
        distStatus.textContent = "Coordinates must be numbers.";
        return;
    }

    const [x1, z1, x2, z2] = numericValues;

    const overworldDistance = Math.round(Math.sqrt((x2 - x1) * (x2 - x1) + (z2 - z1) * (z2 - z1)));
    const netherDistance = Math.round(overworldDistance / 8);

    distResult.innerHTML =
        "Overworld distance: " + overworldDistance + " blocks<br>" +
        "Nether distance: ≈" + netherDistance + " blocks";
});

// --- Tool 5: Nearest buildable portal slot (works even off-grid) -------

const slotXInput = document.getElementById("slotX");
const slotZInput = document.getElementById("slotZ");
const slotBtn = document.getElementById("slotBtn");
const slotStatus = document.getElementById("slotStatus");
const slotResult = document.getElementById("slotResult");

slotBtn.addEventListener("click", function () {
    slotStatus.textContent = "";
    slotResult.innerHTML = "";

    if (motherAnchor === null) {
        slotStatus.style.color = "#ff8a8a";
        slotStatus.textContent = "Generate a grid first so there's a Mother Portal to measure from.";
        return;
    }

    const xVal = slotXInput.value.trim();
    const zVal = slotZInput.value.trim();

    if (xVal === "" || zVal === "") {
        slotStatus.style.color = "#ff8a8a";
        slotStatus.textContent = "Enter both an Overworld X and Z.";
        return;
    }

    const targetX = Number(xVal);
    const targetZ = Number(zVal);

    if (Number.isNaN(targetX) || Number.isNaN(targetZ)) {
        slotStatus.style.color = "#ff8a8a";
        slotStatus.textContent = "Coordinates must be numbers.";
        return;
    }

    const nearest = findNearestLatticePoint(targetX, targetZ);

    const dx = targetX - nearest.overworldX;
    const dz = targetZ - nearest.overworldZ;
    const distanceBlocks = Math.round(Math.sqrt(dx * dx + dz * dz));

    slotResult.innerHTML =
        "<strong>" + nearest.name + "</strong><br>" +
        "Overworld: " + nearest.overworldX + ", " + nearest.overworldZ + "<br>" +
        "Nether: " + nearest.netherX + ", " + nearest.netherZ + "<br>" +
        "≈" + distanceBlocks + " Overworld blocks from what you typed";
});
