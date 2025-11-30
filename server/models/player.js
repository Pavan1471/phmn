const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PlayerSchema = new Schema({
    sessionID: String,
    name: String,
    color: String,
    telegramId: String, // Added telegramId for unique identification
    photo_url: String, // Telegram profile picture URL
});

module.exports = PlayerSchema;
