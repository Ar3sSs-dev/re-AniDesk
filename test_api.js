const { Anixart } = require("anixartjs");

const api = new Anixart();
api.release.info(1).then(res => {
    console.log("Release Info Image:", res.release.image);
});
api.search.searchRelease("naruto").then(res => {
    console.log("Search Result Image:", res.content[0].image);
});
