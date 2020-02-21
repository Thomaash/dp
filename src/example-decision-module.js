module.exports.decisionModule = {
  name: "example-decision-module",
  newTrainEnteredOvertakingArea(
    { getTrainsInArea, planOvertaking },
    { overtakingArea: { itinerary } }
  ) {
    const trainsOnItinerary = getTrainsInArea(itinerary);

    if (
      trainsOnItinerary.length >= 2 &&
      trainsOnItinerary[0].train.maxSpeed < trainsOnItinerary[1].train.maxSpeed
    ) {
      const overtaking = trainsOnItinerary[1].train;
      const waiting = trainsOnItinerary[0].train;
      console.log(
        `Hi there, I'm example decision module and I say that ${overtaking.trainID} should overtake ${waiting.trainID}.`
      );
      planOvertaking(overtaking, waiting);
    } else {
      console.log(
        "Hi there, I'm example decision module and I see no reason for overtaking."
      );
    }
  }
};
