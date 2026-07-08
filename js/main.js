console.log("Portal Architect loaded");

const button = document.getElementById("generateBtn");

button.addEventListener("click", function(){

    const x = document.getElementById("motherX").value;

    const z = document.getElementById("motherZ").value;

    const radius = document.getElementById("radius").value;


    document.getElementById("output").innerHTML = `

    <h2>Mother Portal</h2>

    <p>X: ${x}</p>

    <p>Z: ${z}</p>

    <p>Radius: ${radius}</p>

    `;

});
