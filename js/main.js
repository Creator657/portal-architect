console.log("Portal Architect loaded");


const button = document.getElementById("generateBtn");


button.addEventListener("click", function(){

    const overworldX = Number(
        document.getElementById("motherX").value
    );

    const overworldZ = Number(
        document.getElementById("motherZ").value
    );

    const radius = Number(
        document.getElementById("radius").value
    );


    const netherX = Math.floor(overworldX / 8);

    const netherZ = Math.floor(overworldZ / 8);



const results = document.getElementById("results");

results.innerHTML = "";

for (let z = radius; z >= -radius; z--) {

    const row = document.createElement("div");
    row.className = "portal-row";

    for (let x = -radius; x <= radius; x++) {

        const card = document.createElement("div");
        card.className = "portal-card";

        let name = "";

        if (x === 0 && z === 0) {

            name = "★★★";

        } else {

            if (z > 0) name += "N" + z;
            if (z < 0) name += "S" + Math.abs(z);

            if (x > 0) name += "E" + x;
            if (x < 0) name += "W" + Math.abs(x);

        }

        const portalOverworldX = overworldX + (x * 35);
const portalOverworldZ = overworldZ + (z * 40);

const portalNetherX = Math.floor(portalOverworldX / 8);
const portalNetherZ = Math.floor(portalOverworldZ / 8);
        
        card.innerHTML = `
<div class="portal-frame">

    <div class="portal-center">

        <div class="portal-name">
            ${name}
        </div>

        <div class="portal-coords">

            X: ---

            <br>

            Z: ---

        </div>

    </div>

</div>
`;

        row.appendChild(card);

    }

    results.appendChild(row);

};


});
