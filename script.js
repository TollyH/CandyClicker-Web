/*
 * Candy Clicker ver. 2.0.0 (web)
 * Copyright © 2021-2022  Ptolemy Hill
 */

const shop = [
    { "name": "Auto Clicker", "additionalPerClick": 0n, "additionalPerSecond": 1n, "price": 100n },
    { "name": "Candy Machine", "additionalPerClick": 0n, "additionalPerSecond": 5n, "price": 250n },
    { "name": "Larger Candies", "additionalPerClick": 1n, "additionalPerSecond": 0n, "price": 500n },
    { "name": "Grandma", "additionalPerClick": 2n, "additionalPerSecond": 10n, "price": 1000n },
    { "name": "Candy Shop", "additionalPerClick": 3n, "additionalPerSecond": 15n, "price": 2500n },
    { "name": "Candy Factory", "additionalPerClick": 5n, "additionalPerSecond": 20n, "price": 5000n },
    { "name": "Candy Army", "additionalPerClick": 10n, "additionalPerSecond": 50n, "price": 50000n },
    { "name": "King Candy", "additionalPerClick": 15n, "additionalPerSecond": 60n, "price": 100000n },
    { "name": "Candy Nuke", "additionalPerClick": 25n, "additionalPerSecond": 100n, "price": 250000n },
    { "name": "Planet Candy", "additionalPerClick": 50n, "additionalPerSecond": 500n, "price": 500000n },
    { "name": "Candy Cosmos", "additionalPerClick": 100n, "additionalPerSecond": 750n, "price": 1000000n },
    { "name": "CandyTime Continuum", "additionalPerClick": 250n, "additionalPerSecond": 1000n, "price": 2000000n },
    { "name": "Candyverse Portal", "additionalPerClick": 500n, "additionalPerSecond": 5000n, "price": 5000000n },
    { "name": "Infinite Candy Theory", "additionalPerClick": 1000n, "additionalPerSecond": 10000n, "price": 10000000n },
    { "name": "Unobtainium Candy", "additionalPerClick": 2500n, "additionalPerSecond": 25000n, "price": 15000000n }
];

const uInt64Max = 2n ** 64n - 1n;

let isOnMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

let candyScore = 0n;
let candyPerClick = 1n;
let candyPerSecond = 0n;
let candyPSReincarnationMultiplier = 1n;
let reincarnateCounter = 0n;
let overflowCounter = 0n;
let shopMultiplier = 1n;
const shopPurchasedCount = new Array(shop.length);
shopPurchasedCount.fill(0n);

let clicksTowardSpecial = 0;
let isSpecialActive = false;
let isEndGameVisualActive = false;

let lastClickTime = new Date();
let clicksThisSecond = 0;
const previousClicksPerSecond = [];

let candyPerSecondCycleCount = 0n;

const saveHeader = new Uint8Array([0x43, 0x64, 0x43, 0x6C, 0x6B, 0x31, 0x2E, 0x31]);  // "CdClk1.1"

let timerPerSecond;
let timerCandyPerSecond;
$(window).on('load', function () {
    resizeShop();
    reloadShop();
    updateOverflowBanner();

    if (isOnMobile) {
        $('#download-desktop-paragraph').css('display', 'none');
        $('#save-data-paragraph').css('display', 'none');
    }

    timerPerSecond = setInterval(timerPerSecondElapsed, 1000);
    timerCandyPerSecond = setInterval(timerCandyPerSecondElapsed, 100);

    openHelpPopUp();
});

function calculateInflatedCost(originalPrice, purchasedCount) {
    return BigInt.asUintN(64, originalPrice + (purchasedCount * originalPrice / 4n));
}

function reloadShop() {
    $('#candy-shop').empty();
    for (let i = 0; i < shop.length; i++) {
        let item = shop[i];
        let $template = $('#candy-shop-item-template').contents().clone();
        $template.attr("id", `candy-shop-item-${i}`);
        let tooltip = `+${item.additionalPerClick * shopMultiplier} per click, +${item.additionalPerSecond * shopMultiplier} per second, ${shopPurchasedCount[i]} already purchased`;
        if (shopMultiplier >= 2n) {
            tooltip += `, x${shopMultiplier} applied`;
        }
        $template.attr("title", tooltip);
        if (isOnMobile) {
            $template.css('height', '36px');
        }
        $template.find('.candy-shop-item-name').text(item.name);
        $template.find('.candy-shop-item-price').text(`(${calculateInflatedCost(item.price, shopPurchasedCount[i]).toLocaleString()})`);
        $template.on('click', function () { shopItemClick(i); });
        $template.appendTo('#candy-shop');
    }
    updateShopPriceColours();
}

function updateShopPriceColours() {
    for (let i = 0; i < shop.length; i++) {
        let price = calculateInflatedCost(shop[i].price, shopPurchasedCount[i]);
        $(`#candy-shop-item-${i}`).find('.candy-shop-item-price').css('color', price <= candyScore ? '' : 'gray');
    }
}

function resizeShop() {
    let $candyShop = $('#candy-shop');
    $candyShop.height($(window).height() - $candyShop.offset().top);
}

function updateOverflowBanner() {
    let $overflowBanner = $('#overflow-banner');
    $overflowBanner.css('visibility', overflowCounter == 0n ? 'hidden' : 'visible');
    if (overflowCounter == 0n) {
        // Ensures the bottom margin always applies to prevent shop shifting.
        // Will not be seen by player.
        $overflowBanner.text('★');
    }
    else if (overflowCounter < 1000n) {
        // Check if the target number of stars will actually fit on-screen
        // If not, replace it with a numeric value instead
        $overflowBanner.text('★'.repeat(Number(overflowCounter)));
        if ($overflowBanner.width() > $(window).width() - 20) {
            $overflowBanner.text(`★ x ${overflowCounter}`);
        }
    }
    else {
        $overflowBanner.text(`★ x ${overflowCounter}`);
    }
    $overflowBanner.css('margin-top', -$overflowBanner.height());
}

$(window).on('resize', function () {
    resizeShop();
    updateOverflowBanner();
});

function initiateSpecial() {
    isSpecialActive = true;
    let $mainCandy = $('#main-candy');
    let $perClickMultiplier = $('#per-click-multiplier');
    $mainCandy.attr('src', 'images/candy-special.png');
    $perClickMultiplier.css('visibility', 'visible');
    let $candyMeter = $('#candy-meter');
    setTimeout(function () {
        $mainCandy.attr('src', 'images/candy.png');
        $perClickMultiplier.css('visibility', 'hidden');
        $candyMeter.prop('value', 0);
        isSpecialActive = false;
        clicksTowardSpecial = 0;
    }, 5000);
    let i = 0;
    let timerSpecialCountdown = setInterval(function () {
        if (i == 50) {
            clearTimeout(timerSpecialCountdown);
        }
        else {
            $candyMeter.prop('value', 1000 - (20 * (i + 2)));
            i++;
        }
    }, 100);
}

function endGameVisualUpdate() {
    isEndGameVisualActive = true;
    $('body').css("background-color", '#E5F19E');
}

function undoEndGameVisualUpdate() {
    isEndGameVisualActive = false;
    $('body').css("background-color", '');
}

function uInt64ToByteArray(num) {
    let bytes = [];
    for (let i = 0n; i < 64n; i += 8n) {
        bytes.push(Number(BigInt.asUintN(8, num >> i)));
    }
    return new Uint8Array(bytes);
}

function byteArrayToUInt64(bytes) {
    let num = 0n;
    for (let i = 0; i < bytes.length; i++) {
        num += BigInt(bytes[i]) << BigInt(i * 8);
    }
    return BigInt.asUintN(64, num);
}

function loadSaveBytes(bytes) {
    try {
        let header = bytes.slice(0, 8);
        for (let i = 0; i < 8; i++) {
            if (header[i] != saveHeader[i]) {
                throw "Invalid save file";
            }
        }
        let saveBytes = bytes.slice(8);
        let hashBytes = saveBytes.slice(saveBytes.length - 16);
        let testHash = md5.array(saveBytes.slice(0, saveBytes.length - 16));
        for (let i = 0; i < 16; i++) {
            if (hashBytes[i] != testHash[i]) {
                throw "Invalid save file";
            }
        }

        candyScore = byteArrayToUInt64(saveBytes.slice(0, 8));
        candyPerClick = byteArrayToUInt64(saveBytes.slice(8, 16));
        candyPerSecond = byteArrayToUInt64(saveBytes.slice(16, 24));
        clicksTowardSpecial = 0;
        updateReincarnationMultiplier(byteArrayToUInt64(saveBytes.slice(24, 32)));
        reincarnateCounter = byteArrayToUInt64(saveBytes.slice(32, 40));
        overflowCounter = byteArrayToUInt64(saveBytes.slice(40, 48));
        shopMultiplier = byteArrayToUInt64(saveBytes.slice(48, 56));

        for (let i = 0; i < (saveBytes.length - 72) / 8 && i < shopPurchasedCount.length; i++) {
            shopPurchasedCount[i] = byteArrayToUInt64(saveBytes.slice((i * 8) + 56, (i * 8) + 64));
        }

        $('#candy-score').text(candyScore.toLocaleString());
        $('#candy-per-second-value').text(candyPerSecond.toLocaleString());
        $('#candy-per-click-value').text(candyPerClick.toLocaleString());
        $('#candy-meter').prop('value', clicksTowardSpecial);
        updateOverflowBanner();
        reloadShop();
    }
    catch {
        alert("Modified or corrupt save file detected");
    }
}

function getSaveBytes() {
    let candyScoreBytes = new Uint8Array(56);
    candyScoreBytes.set(uInt64ToByteArray(candyScore));
    candyScoreBytes.set(uInt64ToByteArray(candyPerClick), 8);
    candyScoreBytes.set(uInt64ToByteArray(candyPerSecond), 16);
    candyScoreBytes.set(uInt64ToByteArray(candyPSReincarnationMultiplier), 24);
    candyScoreBytes.set(uInt64ToByteArray(reincarnateCounter), 32);
    candyScoreBytes.set(uInt64ToByteArray(overflowCounter), 40);
    candyScoreBytes.set(uInt64ToByteArray(shopMultiplier), 48);

    let purchasedItemsBytes = new Uint8Array(shopPurchasedCount.length * 8);
    for (let i = 0; i < shopPurchasedCount.length; i++) {
        purchasedItemsBytes.set(uInt64ToByteArray(shopPurchasedCount[i]), i * 8);
    }

    let combinedBytes = new Uint8Array(saveHeader.length + candyScoreBytes.length + purchasedItemsBytes.length + 16);
    combinedBytes.set(saveHeader);
    combinedBytes.set(candyScoreBytes, saveHeader.length);
    combinedBytes.set(purchasedItemsBytes, saveHeader.length + candyScoreBytes.length);

    let hashBytes = new Uint8Array(md5.array(combinedBytes.slice(8, combinedBytes.length - 16)));
    combinedBytes.set(hashBytes, saveHeader.length + candyScoreBytes.length + purchasedItemsBytes.length);
    return combinedBytes;
}

function giveCandy(amount) {
    if (amount == 0n) {
        return;
    }
    let oldCandyScore = candyScore;
    candyScore = BigInt.asUintN(64, candyScore + amount);
    $('#candy-score').text(candyScore.toLocaleString());
    if (oldCandyScore > candyScore) {
        giveOverflow(1n);
    }
    updateShopPriceColours();
}

function givePerSecond(amount) {
    if (amount == 0n) {
        return;
    }
    candyPerSecond = BigInt.asUintN(64, candyPerSecond + amount);
    $('#candy-per-second-value').text(candyPerSecond.toLocaleString());
}

function givePerClick(amount) {
    if (amount == 0n) {
        return;
    }
    candyPerClick = BigInt.asUintN(64, candyPerClick + amount);
    $('#candy-per-click-value').text(candyPerClick.toLocaleString());
}

function giveOverflow(amount) {
    if (amount == 0n) {
        return;
    }
    overflowCounter = BigInt.asUintN(64, overflowCounter + amount);
    updateOverflowBanner();
}

function updateReincarnationMultiplier(multiplier) {
    candyPSReincarnationMultiplier = multiplier;
    $('#per-second-multiplier').css('visibility', multiplier <= 1n || multiplier == uInt64Max ? 'hidden' : '');
    $('#per-second-multiplier-value').text(multiplier.toLocaleString());
}

function openHelpPopUp() {
    clearInterval(timerPerSecond);
    clearInterval(timerCandyPerSecond);

    let $helpPopUp = $('#help-popup-container');
    $helpPopUp.css('display', '');
    $helpPopUp.animate({ opacity: '1.0' }, 250);
}

function closeHelpPopUp() {
    timerPerSecond = setInterval(timerPerSecondElapsed, 1000);
    timerCandyPerSecond = setInterval(timerCandyPerSecondElapsed, 100);

    let $helpPopUp = $('#help-popup-container');
    $helpPopUp.animate({ opacity: '0.0' }, 250);
    setTimeout(function () {
        $helpPopUp.css('display', 'none');
    }, 300);
}

function calculateReincarnationCost() {
    let result = BigInt.asUintN(64, 100000000n * (candyPSReincarnationMultiplier + 1n) * (reincarnateCounter + 1n));
    return result >= BigInt.asUintN(64, candyPSReincarnationMultiplier * 100000000n * reincarnateCounter) ? result : uInt64Max;
}

function calculateReincarnationResult() {
    let result = BigInt.asUintN(64, (overflowCounter == 0n ? candyScore : uInt64Max) / 100000000n / (reincarnateCounter + 1n));
    return result >= candyPSReincarnationMultiplier ? result : uInt64Max;
}

function openReincarnationPopUp() {
    clearInterval(timerPerSecond);
    clearInterval(timerCandyPerSecond);

    let reincarnationCost = calculateReincarnationCost();
    let $reincarnationParagraph = $('#reincarnation-paragraph');
    let $endgameReincarnationParagraph = $('#endgame-reincarnation-paragraph');
    let $reincarnationParagraphResultLine = $('#reincarnation-paragraph-result-line');
    let $endgameReincarnationParagraphResultLine = $('#endgame-reincarnation-paragraph-result-line');
    let $reincarnateAgreeButton = $('#reincarnate-agree-button');
    $reincarnationParagraphResultLine.css('display', 'none');
    $endgameReincarnationParagraphResultLine.css('display', 'none');
    $('#reincarnation-paragraph-divisor').text(BigInt.asUintN(64, 100000000n * (reincarnateCounter + 1n)).toLocaleString());
    $('#reincarnation-paragraph-min-cost').text(reincarnationCost.toLocaleString());
    if (candyScore >= reincarnationCost || overflowCounter >= 1) {
        if (candyPSReincarnationMultiplier == uInt64Max) {
            $reincarnationParagraph.css('display', 'none');
            $endgameReincarnationParagraph.css('display', '');
            if (overflowCounter >= 60n) {
                $reincarnateAgreeButton.prop('disabled', false);
                $reincarnateAgreeButton.text("Reincarnate (!)");
                $reincarnateAgreeButton.css('color', '');
                $reincarnateAgreeButton.css('background-color', '');
                $reincarnateAgreeButton.css('border-color', '');
                $endgameReincarnationParagraphResultLine.css('display', '');
                $('#endgame-reincarnation-paragraph-result').text(BigInt.asUintN(64, shopMultiplier + (overflowCounter / 60n)).toLocaleString());
            }
            else {
                $reincarnateAgreeButton.prop('disabled', true);
                $reincarnateAgreeButton.text("Not Enough Stars");
                $reincarnateAgreeButton.css('color', 'gray');
                $reincarnateAgreeButton.css('background-color', '#f4f4f4');
                $reincarnateAgreeButton.css('border-color', '#adb2b5');
            }
        }
        else {
            $reincarnationParagraph.css('display', '');
            $endgameReincarnationParagraph.css('display', 'none');
            $reincarnateAgreeButton.prop('disabled', false);
            $reincarnateAgreeButton.text("Reincarnate");
            $reincarnateAgreeButton.css('color', '');
            $reincarnateAgreeButton.css('background-color', '');
            $reincarnateAgreeButton.css('border-color', '');
            $reincarnationParagraphResultLine.css('display', '');
            $('#reincarnation-paragraph-result').text(calculateReincarnationResult().toLocaleString());
        }
    }
    else {
        $reincarnationParagraph.css('display', '');
        $endgameReincarnationParagraph.css('display', 'none');
        $reincarnateAgreeButton.prop('disabled', true);
        $reincarnateAgreeButton.text("Not Enough Candy");
        $reincarnateAgreeButton.css('color', 'gray');
        $reincarnateAgreeButton.css('background-color', '#f4f4f4');
        $reincarnateAgreeButton.css('border-color', '#adb2b5');
    }

    let $reincarnationPopUp = $('#reincarnation-popup-container');
    $reincarnationPopUp.css('display', '');
    $reincarnationPopUp.animate({ opacity: '1.0' }, 250);
}

function closeReincarnationPopUp() {
    timerPerSecond = setInterval(timerPerSecondElapsed, 1000);
    timerCandyPerSecond = setInterval(timerCandyPerSecondElapsed, 100);

    let $reincarnationPopUp = $('#reincarnation-popup-container');
    $reincarnationPopUp.animate({ opacity: '0.0' }, 250);
    setTimeout(function () {
        $reincarnationPopUp.css('display', 'none');
    }, 300);
}

$('#main-candy').on('click', function () {
    if (new Date() > new Date(lastClickTime.getTime() + 40)) {
        giveCandy(isSpecialActive ? candyPerClick * 10n : candyPerClick);
        if (!isSpecialActive) {
            clicksTowardSpecial++;
            if (clicksTowardSpecial == 1000) {
                initiateSpecial();
            }
            else {
                $('#candy-meter').prop('value', clicksTowardSpecial);
            }
        }
        lastClickTime = new Date();
        clicksThisSecond++;
        let $mainCandy = $('#main-candy');
        $mainCandy.clearQueue();
        $mainCandy.animate({ width: Math.random() <= 0.05 ? '0px' : '162px' }, 50);
        $mainCandy.animate({ width: '172px' }, 50);
    }
});

function shopItemClick(itemIndex) {
    let purchasedItem = shop[itemIndex];
    let adjustedPrice = calculateInflatedCost(purchasedItem.price, shopPurchasedCount[itemIndex]);
    if (adjustedPrice <= candyScore) {
        candyScore -= adjustedPrice;
        $('#candy-score').text(candyScore.toLocaleString());
        givePerSecond(purchasedItem.additionalPerSecond * shopMultiplier);
        givePerClick(purchasedItem.additionalPerClick * shopMultiplier);
        shopPurchasedCount[itemIndex]++;
        let $clickedItem = $(`#candy-shop-item-${itemIndex}`)
        $clickedItem.find('.candy-shop-item-price').text(`(${calculateInflatedCost(purchasedItem.price, shopPurchasedCount[itemIndex]).toLocaleString()})`);
        let tooltip = `+${purchasedItem.additionalPerClick * shopMultiplier} per click, +${purchasedItem.additionalPerSecond * shopMultiplier} per second, ${shopPurchasedCount[itemIndex]} already purchased`;
        if (shopMultiplier >= 2n) {
            tooltip += `, x${shopMultiplier} applied`;
        }
        $clickedItem.prop("title", tooltip);
    }
    else {
        let $candyScore = $("#candy-score");
        $candyScore.clearQueue();
        $candyScore.animate({ opacity: '0.5' }, 50);
        $candyScore.animate({ opacity: '1.0' }, 50);
    }
}

$('#help-button').on('click', openHelpPopUp);

$('#help-popup-close-button').on('click', closeHelpPopUp);

$('#reincarnate-button').on('click', openReincarnationPopUp);

$('#reincarnation-popup-close-line').on('click', closeReincarnationPopUp);

$('#reincarnate-agree-button').on('click', function () {
    if (candyScore >= calculateReincarnationCost() || overflowCounter >= 1) {
        if (candyPSReincarnationMultiplier != uInt64Max) {
            updateReincarnationMultiplier(calculateReincarnationResult());
            reincarnateCounter++;
        }
        else {
            updateReincarnationMultiplier(1n);
            reincarnateCounter = 0n;
            shopMultiplier += overflowCounter / 60n;
        }
        candyScore = 0n;
        candyPerClick = 1n;
        candyPerSecond = 0n;
        clicksTowardSpecial = 0;
        overflowCounter = 0n;
        shopPurchasedCount.fill(0n);

        $('#candy-score').text(candyScore.toLocaleString());
        $('#candy-per-second-value').text(candyPerSecond.toLocaleString());
        $('#candy-per-click-value').text(candyPerClick.toLocaleString());
        $('#candy-meter').prop('value', clicksTowardSpecial);
        updateOverflowBanner();
        reloadShop();

        closeReincarnationPopUp();
    }
});

$('#save-button').on('click', function () {
    let saveBytes = getSaveBytes();
    if (isOnMobile && confirm("Are you sure? This will overwrite any existing save data")) {
        localStorage.setItem('save_data', saveBytes.join());
    }
    else {
        download(saveBytes, 'save_data.dat', 'application/octet-stream');
    }
});

$('#load-button').on('click', function () {
    if (isOnMobile && confirm("Are you sure? This will overwrite your current progress with the save data")) {
        loadSaveBytes(new Uint8Array(localStorage.getItem('save_data').split(',')));
    }
    else {
        let $hiddenUploader = $('#hidden-uploader');
        $hiddenUploader.on('change', function () {
            let reader = new FileReader();
            reader.onload = function () {
                loadSaveBytes(new Uint8Array(reader.result));
            }
            reader.readAsArrayBuffer($hiddenUploader.prop('files')[0]);
        });
        $hiddenUploader.trigger("click");
    }
});

function timerPerSecondElapsed() {
    if (!isEndGameVisualActive && candyPSReincarnationMultiplier == uInt64Max) {
        endGameVisualUpdate();
    }
    else if (isEndGameVisualActive && candyPSReincarnationMultiplier != uInt64Max) {
        undoEndGameVisualUpdate();
    }
    let $candyPerSecondEndgame = $('#total-candy-per-second-endgame');
    $candyPerSecondEndgame.css('display', isEndGameVisualActive ? '' : 'none');
    $candyPerSecondEndgame.css('visibility', isEndGameVisualActive && candyPerSecond == 0n ? 'hidden' : '');
    $('#total-candy-per-second').css('display', isEndGameVisualActive ? 'none' : '');
    if ((new Date() - lastClickTime) >= 5000) {
        previousClicksPerSecond.length = 0;
        $('#clicks-per-second-value').text("0.0");
    }
    else {
        previousClicksPerSecond.push(clicksThisSecond);
        clicksThisSecond = 0;
        // First value is skipped as it will most likely be lower than expected
        if (previousClicksPerSecond.length >= 2) {
            $('#clicks-per-second-value').text((previousClicksPerSecond.slice(1).reduce((a, b) => a + b) / (previousClicksPerSecond.length - 1)).toFixed(1));
        }
    }
    if (!isEndGameVisualActive) {
        let perSecond = candyPSReincarnationMultiplier <= 1 ? candyPerSecond : candyPerSecond * candyPSReincarnationMultiplier;
        let clicksPerSecond = previousClicksPerSecond.length >= 2 ? previousClicksPerSecond.slice(1).reduce((a, b) => a + b) / (previousClicksPerSecond.length - 1) : 0;
        let perClick = isSpecialActive ? candyPerClick * 10n : candyPerClick;
        $('#total-candy-per-second-value').text((BigInt(Math.round(Number(perClick) * clicksPerSecond)) + perSecond).toLocaleString());
    }
}

function timerCandyPerSecondElapsed() {
    let amount = candyPSReincarnationMultiplier <= 1n
        ? candyPerSecond
        : candyPerSecond <= BigInt.asUintN(64, candyPerSecond * candyPSReincarnationMultiplier)
            ? BigInt.asUintN(64, candyPerSecond * candyPSReincarnationMultiplier)
            : uInt64Max;
    if (amount == 0n) {
        return;
    }
    let perTick = amount / 10n;
    let remainder = amount % 10n;
    let toGive = perTick;
    if (remainder != 0n && candyPerSecondCycleCount % (10n / remainder) == 0n) {
        toGive++;
    }
    giveCandy(toGive);
    candyPerSecondCycleCount++;
    if (candyPerSecondCycleCount == 10n) {
        candyPerSecondCycleCount = 0n;
    }
}

$(window).bind('beforeunload', function () {
    return "Are you sure you want to leave? Any progress since your last save will be lost!";
});
