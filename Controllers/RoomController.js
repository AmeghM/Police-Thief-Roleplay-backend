exports.getRoomController = async (req, res) => {
  try {
    const allRooms = await Room.find();
    res.json(allRooms);
  } catch (err) {
    console.log(err);
  }
};
