const cardextraction = (value: number, shape: number, cardlen: number) => {
  const cards: {
    value: number;
    shape: number;
  }[] = [];
  for (let index = 0; index < cardlen; index++) {
    cards.push({
      value: value % 100,
      shape: shape % 10,
    });
    if (value > 0) {
      value /= 100;
    }
    if (shape > 0) {
      shape /= 10;
    }
  }
};
