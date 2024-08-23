
// Place this code into a Squarespace code block.  It needs the follow to "attach" to BEFORE using <script>
// <div id='calculatorContainer' style='margin-top: -100px; display: flex; justify-content: center;'></div>


// Container block to attach to:
const calculatorContainer = document.getElementById('calculatorContainer');

async function loadForm() {
    calculatorContainer.insertAdjacentHTML('afterbegin', `
        <form 
            id='formShippingQuoteCalculator' 
            method='get'
            style='
                max-width: 500px;
                padding: 2em;
                font-family: Altivo;
                font-weight: 300;
                font-size: 1rem;
                color: white;
                display: flex;
                flex-direction: column;
                gap: 1em;
                border: 0px solid black;
                border-radius: 1em;
                background-color: rgb(10, 49, 177);
            '
        >

            <header
                style='
                    font-size: 1.5rem;
                    font-weight: 500;
                '
            
            >Get A Free Instant Freight Quote:</header>

            <label for='origin'
                style='
                    width: 100%;
                '
            
            >Origin ZIP:
                <input type='text' id='origin' required 
                    style='
                        width: 100%;
                    '
                />
            </label>
            <label for='destination'>Destination ZIP:
                <input type='text' id='destination' required 
                    style='
                        width: 100%;
                    '
                />
            </label>

            <label for='weight'>Weight (up to 45,000lbs):
                <input type='number' id='weight' min='1' max='45000' required 
                    style='
                        width: 100%;
                    '
                />
            </label>

            <fieldset
                style='
                    display: flex;
                    gap: .5rem;
                '
            >
                <legend>Input Your Dimensions In Inches:</legend>
                <label for='dimensionLength'>LENGTH (1-630"):
                    <input type='number' id='dimensionLength' min='1' max='630' required />
                </label>
                <label for='dimensionWidth'>WIDTH (1-100"):
                    <input type='number' id='dimensionWidth' min='1' max='100' required />
                </label>
                <label for='dimensionHeight'>HEIGHT (1-110"):
                    <input type='number' id='dimensionHeight' min='1' max='110' required />
                </label>
            </fieldset>     


            <button type='submit'
                style='
                    font-family: Altivo;
                    font-size: 1.25rem;
                    font-weight: 300;
                    color: black;
                    padding: 0.6rem 1.6rem 0.6rem 1.6rem;
                    border: 0 solid black;
                    border-radius: 9999px;
                    background-color: white;
                '
            >Get A Quote</button>
                    
            <div id='results'
                style='
                    display: flex;
                    flex-direction: column;
                '   
            >
            </div>
        </form>
    `)
}
loadForm(); // Loads Form HTML/CSS.

// This must load before the function can correctly work.  Loads FIRST.
function loadGoogleMapsAPI() {
    const apiKEY = '';
    const loading = 'async';
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKEY}&loading=${loading}&libraries=places&callback=`;
    script.defer = true;
    document.head.appendChild(script);
}
loadGoogleMapsAPI(); // Loads Google Maps API Before Triggering It.  Async issues otherwise.

// Listener:  Listening for the form to be submitted.
const formShippingQuoteCalculator = document.getElementById('formShippingQuoteCalculator');
formShippingQuoteCalculator.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
        origin: document.getElementById('origin').value,
        destination: document.getElementById('destination').value,
        weight: document.getElementById('weight').value,
        dimensions: {
            "length": document.getElementById('dimensionLength').value,
            "width": document.getElementById('dimensionWidth').value,
            "height": document.getElementById('dimensionHeight').value
        },
        
    }

    if (formData.weight == "") { formData.weight = 45_000; console.log("Weight Left Empty.  Changing Value to 45,000") }; 
    if (formData.dimensions.length == "") { formData.dimensions.length = 630; console.log("Length Dimension Left Empty.  Changing Value to 630"); }
    if (formData.dimensions.width == "") { formData.dimensions.width = 100; console.log("Width Dimension Left Empty.  Changing Value to 100"); }
    if (formData.dimensions.height == "") { formData.dimensions.height = 110; console.log("Height Dimension Left Empty.  Changing Value to 110"); }

    // getDistance starts the chain of calculations.
    await getDistance(formData);
})

// getDistance takes in origin & destination zip codes and uses Google Maps API to get distance and location information.
async function getDistance(formData) {
    
    const origin1 = formData.origin;
    const destinationA = formData.destination;
    
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        console.log(`Please wait.  Loading Google Maps API.`)
        loadGoogleMapsAPI();
        setTimeout(() => {
        }, 5000);
    }

    try {
        const service = new google.maps.DistanceMatrixService();
        service.getDistanceMatrix(
            {
                origins: [origin1],
                destinations: [destinationA],
                travelMode: 'DRIVING',
            }, (response, status) => {
                const distanceObj = response;

                getShippingQuote(formData, distanceObj);
            });
    } catch (error) {
        console.error("getDistance Error: ", error);
    }
}

async function getShippingQuote(formData, distanceObj){

    // originAddresses & destinationAddresses are formatted:  City Name, XX 00000, USA <-- Loop through with getStateAbbreviation to get State Abbreviation.
    const originState = await getStateAbbreviation(distanceObj.originAddresses[0]);
    const destinationState = await getStateAbbreviation(distanceObj.destinationAddresses[0]);

    // Gets Lane Rate Data From lanes.json.
    const laneRateData = await getLaneRate(originState, destinationState);

    // Calculating from meters to miles.  Google API returns distance in meters.
    const distanceInMiles = Math.round(distanceObj.rows[0].elements[0].distance.value * 0.000621);

    let fullTruckLoadCost = distanceInMiles * laneRateData.rate;
    if (fullTruckLoadCost < 1000) {fullTruckLoadCost = 1000; }

    const percentageOfTruck = await getPercentageCost(formData.weight, formData.dimensions); 

    const finalPercent = percentageOfTruck.roundedPercent;

    const finalTruckLoadCost = fullTruckLoadCost * (finalPercent / 100);

    const totalCostQuote = Number(finalTruckLoadCost).toFixed(2);

    // Shows results to end user.
    createResultsUI(totalCostQuote);

    // This is the end of the function chain.

    return;
}

async function getStateAbbreviation(str){
    let arr = Array.from(str);
    for (let i = 0; i < arr.length; i++) {
        // Find the ',' after a city name.
        if (arr[i] === ','){
            // skips the space after ',' and returns the two letter abbreviation
            return arr[i+2] + arr[i+3]; 
        }
    }
}

function getPercentageCost(weight, dimensions){
    // Max Truck Size For 53' Truck:  45,000 pounds, 630" long, 100" wide, 110" high.
    const maxTruckSize = {
        weight: 45_000,
        length: 630,
        width: 100,
        height: 110
    }

    const weightPercentage = Number((weight / maxTruckSize.weight) * 100).toFixed(2);
    const lengthPercentage = Number((dimensions.length / maxTruckSize.length) * 100).toFixed(2);

    let percent = 0;

    if (weightPercentage >= lengthPercentage) { percent = weightPercentage } ;
    if (lengthPercentage > weightPercentage) { percent = lengthPercentage };

    let finalPercent = 0;

    // Breakpoints:
    if (percent <= 10) { finalPercent = 25.00; };
    if (percent > 10 && percent <= 25) { finalPercent = 33.33; };
    if (percent > 25 && percent <= 33.33) { finalPercent = 50.00; };
    if (percent > 33.33 && percent <= 50) { finalPercent = 66.67; };
    if (percent > 50 && percent <= 100) { finalPercent = 100.00; };

    const returnObject = {
        weightPercent: weightPercentage,
        sizePercent: lengthPercentage,
        roundedPercent: finalPercent
    }

    return returnObject;
}

async function getLaneRate(originState, destinationState) {
    // This function fetches the lanes.json data then:
    // Crawls through the data depending on the user selected origin state and destination state.
    // Returning the associated data object.

    try {
        const webAddress = '';
        const localAddress = './lanes.json';
        const response = await fetch(webAddress); // Fetch Lanes.json data object.
        const data = await response.json();

        // Loop through lanes.json data to find origin state first.
        for (let key1 in data.origin) {
            if (key1 == originState){
                // Looping through found origin state to find destination state.  Then returning coresponding data object.
                for (let key2 in data.origin[key1].destination){
                    if (key2 == destinationState){
                        const returnObject = {
                            "originStateName": data.origin[key1].name,
                            "destinationStateName": data.origin[key1].destination[key2].name,
                            "routeStatus": data.origin[key1].destination[key2].available,
                            "rate": data.origin[key1].destination[key2].rate
                        }
                        return returnObject;
                    }
                }
            }
        }
    } catch (error) {
        return console.error("Error: ", error);
    }
    return console.error("Some kind of error occured in getLaneRate function");
}

// After all calculations are run, this function displays the results:
function createResultsUI(finalQuote){
    const results = document.getElementById('results');
    finalQuote = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(finalQuote);
    results.innerHTML = '';
    results.insertAdjacentHTML('afterbegin', `
        <p style='
            font-size: 2rem;
            align-self: center;
            color: lime;
        '><b>${finalQuote}</b></p>
        <p>Disclaimer: Prices provided with this tool are an estimate. Please contact us to discuss the details of your freight needs.</p>
    `)
}
