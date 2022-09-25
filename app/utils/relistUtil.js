import { idFixedBINPrice, idFixedStartPrice } from "../app.constants";
import { showPopUp } from "../function-overrides/popup-override";
import { fetchPrices } from "../services/futbin";
import { getValue } from "../services/repository";
import { getRandNumberInRange, hideLoader, showLoader } from "./commonUtil";
import { sendUINotification } from "./notificationUtil";
import { listForPrice } from "./sellUtil";
import { t } from "../services/translate";

export const relistForFixedPrice = function (sectionHeader) {
  showPopUp(
    [
      { labelEnum: enums.UIDialogOptions.OK },
      { labelEnum: enums.UIDialogOptions.CANCEL },
    ],
    t("listFixed"),
    `<input id=${idFixedStartPrice} type="number" class="ut-text-input-control fut-bin-buy" placeholder=${t(
      "startPrice"
    )} />
    <br/>
    <input id=${idFixedBINPrice} type="number" class="ut-text-input-control fut-bin-buy" placeholder=${t(
      "binPrice"
    )} />
    <br/>
    <br/>
    <label>${t("cardsIgnoreInfo")}</label>
    `,
    (text) => {
      const price = parseInt($(`#${idFixedBINPrice}`).val());
      const startPrice = parseInt($(`#${idFixedStartPrice}`).val());
      if (text === 2 && (isNaN(price) || !price)) {
        sendUINotification(t("binNotGiven"), UINotificationType.NEGATIVE);
        return;
      }

      if (startPrice && startPrice > price) {
        sendUINotification(t("binLesser"), UINotificationType.NEGATIVE);
        return;
      }

      text === 2 && relistCards(sectionHeader, price, startPrice);
    }
  );
};

export const relistCards = function (sectionHeader, price, startPrice) {
  if (
    [
      services.Localization.localize("infopanel.label.alltoclub"),
      services.Localization.localize("infopanel.label.storeAllInClub"),
    ].indexOf(sectionHeader) >= 0
  ) {
    handleWatchListOrUnAssignedItems(sectionHeader, price, startPrice);
    return;
  }
  handleTransferListItems(sectionHeader, price, startPrice);
};

const handleWatchListOrUnAssignedItems = (sectionHeader, price, startPrice) => {
  const isWatchList =
    services.Localization.localize("infopanel.label.alltoclub") ===
    sectionHeader;
  services.Item[
    isWatchList ? "requestWatchedItems" : "requestUnassignedItems"
  ]().observe(this, async function (t, response) {
    let boughtItems = response.response.items;
    if (isWatchList) {
      boughtItems = boughtItems.filter(function (item) {
        return item.getAuctionData().isWon();
      });
    }
    listCards(boughtItems, price, startPrice, false);
  });
};

const handleTransferListItems = (sectionHeader, price, startPrice) => {
  services.Item.requestTransferItems().observe(
    this,
    async function (t, response) {
      if (
        sectionHeader ===
        services.Localization.localize("tradepile.button.relistall")
      ) {
        let unSoldItems = response.response.items.filter(function (item) {
          var t = item.getAuctionData();
          return t.isExpired() || (t.isValid() && t.isInactive());
        });

        listCards(unSoldItems, price, startPrice, true);
      } else if (
        sectionHeader ===
        services.Localization.localize("infopanel.label.addplayer")
      ) {
        const availableItems = response.response.items.filter(function (item) {
          return !item.getAuctionData().isValid();
        });
        listCards(availableItems, price, startPrice, true);
      }
    }
  );
};

export const listCards = async (cards, price, startPrice, isRelist) => {
  cards = cards.filter((card) => !card.untradeable);
  if (!cards.length) {
    sendUINotification(t("noCardsToList"), UINotificationType.NEGATIVE);
    return;
  }
  showLoader();
  if (price) {
    sendUINotification(`${t("listingCards")} ${price}`);
    await listCardsForFixedPrice(cards, price, startPrice, isRelist);
  } else {
    sendUINotification(t("listingCardsFutBin"));
    await listCardsForFutBIN(cards, isRelist);
  }
  hideLoader();
  sendUINotification(t("listingCardsCompleted"));
};

const listCardsForFixedPrice = async (cards, price, startPrice, isRelist) => {
  for (const card of cards) {
    await listCard(price, card, true, startPrice);
  }
};

const listCardsForFutBIN = async (cards, isRelist) => {
  await fetchPrices(cards);

  for (const card of cards) {
    const existingValue = getValue(card.definitionId);
    if (existingValue && existingValue.price) {
      await listCard(computeSalePrice(existingValue.price), card);
    } else {
      sendUINotification(
        `${t("priceMissing")} ${card._staticData.name}`,
        UINotificationType.NEGATIVE
      );
    }
  }
};

const listCard = async (price, card, isFixedPrice, startPrice) => {
  const [isListed, lisitedPrice] = await listForPrice(
    price,
    card,
    isFixedPrice,
    startPrice
  );
  if (!isListed) {
    return sendUINotification(
      t("priceNotInRange"),
      UINotificationType.NEGATIVE
    );
  }
  sendUINotification(
    `${t("listed")} ${card._staticData.name} - ${lisitedPrice}`
  );
};

const computeSalePrice = (cardPrice) => {
  const futBinPercent =
    getRandNumberInRange(getValue("EnhancerSettings")["idFutBinPercent"]) ||
    100;
  return (cardPrice * futBinPercent) / 100;
};
