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



    document.getElementById("results").innerHTML = `

        <div class="portal-result">

            <h3>🟪 Mother Portal</h3>

            <p>
            Overworld:
            <br>
            X: ${overworldX}
            <br>
            Z: ${overworldZ}
            </p>


            <p>
            Nether:
            <br>
            X: ${netherX}
            <br>
            Z: ${netherZ}
            </p>


            <p>
            Grid Radius:
            ${radius}
            </p>


        </div>

    `;


});
