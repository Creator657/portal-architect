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

    const results = document.getElementById("results");
    results.innerHTML = "";

    for (let z = radius; z >= -radius; z--) {

        const row = document.createElement("div");
        row.className = "portal-row";

        for (let x = -radius; x <= radius; x++) {

            const card = document.createElement("div");
            card.className = "portal-card";

            let name = "";
            const isCenter = x === 0 && z === 0;

            if (isCenter) {
                name = "★★★";
                card.classList.add("mother-portal");
            } else {
                if (z > 0) name += "N" + z;
                if (z < 0) name += "S" + Math.abs(z);

                if (x > 0) name += "E" + x;
                if (x < 0) name += "W" + Math.abs(x);
            }

            const portalNetherX = netherX + (x * 35);
            const portalNetherZ = netherZ + (z * 40);

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

    </div>

</div>
`;

            row.appendChild(card);
        }

        results.appendChild(row);
    }
});
