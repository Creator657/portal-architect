console.log("Portal Architect loaded");

const button = document.getElementById("generateBtn");
const errorEl = document.getElementById("formError");

function showError(message) {
    errorEl.textContent = message;
}

button.addEventListener("click", function () {

    errorEl.textContent = "";

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

    radius = Math.trunc(radius);

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
            } else {
                if (z > 0) name += "N" + z;
                if (z < 0) name += "S" + Math.abs(z);

                if (x > 0) name += "E" + x;
                if (x < 0) name += "W" + Math.abs(x);
            }

            const portalNetherX = netherX + (x * 35);
            const portalNetherZ = netherZ + (z * 40);

            // The mother portal keeps the exact Overworld coordinates you typed in.
            // Every other portal is derived from the Nether grid, so its Overworld
            // coordinate is the rounded eight-block conversion of that grid point.
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
