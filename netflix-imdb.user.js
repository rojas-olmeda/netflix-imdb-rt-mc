// ==UserScript==
// @name         Puntajes Netflix
// @version      0.1
// @description  Mostrar puntajes de netflix (Basado en el trabajo de Ioannis Ioannou)
// @author       Nayibi Rojas y Julian Olmeda
// @match        https://www.netflix.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_openInTab
// @connect      imdb.com
// @resource     css  https://raw.githubusercontent.com/rojas-olmeda/netflix-imdb-rt-mc/master/netflix-imdb.css
// @resource     icon   https://raw.githubusercontent.com/rojas-olmeda/netflix-imdb-rt-mc/master/imdb-icon2.png
// @updateURL    https://github.com/rojas-olmeda/netflix-imdb-rt-mc/raw/master/netflix-imdb.user.js
// @downloadURL  https://github.com/rojas-olmeda/netflix-imdb-rt-mc/raw/master/netflix-imdb.user.js
// ==/UserScript==

(function() {
    "use strict";

    GM_addStyle(GM_getResourceText("css"));

    var domParser = new DOMParser();

    function GM_xmlhttpRequest_get(url, cb) {
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: function(x) { cb(null, x); },
            onerror: function() { cb("Fallo el request a " + url); }
        });
    }

    function requestRating(title, cb) {
        var searchUrl = "https://www.imdb.com/find?s=tt&q=" + title;
        GM_xmlhttpRequest_get(searchUrl, function(err, searchRes) {
            if (err) return cb(err);
            var searchResParsed = domParser.parseFromString(searchRes.responseText, "text/html");
            var link = searchResParsed.querySelector(".result_text > a");
            var titleEndpoint = link && link.getAttribute("href");
            if (!titleEndpoint) return cb(null, {});
            var titleUrl = "https://www.imdb.com" + titleEndpoint;
            GM_xmlhttpRequest_get(titleUrl, function(err, titleRes) {
                if (err) return cb(err);
                var titleResParsed = domParser.parseFromString(titleRes.responseText, "text/html");
                var imdbRating = titleResParsed.querySelector(".imdbRating");
                var score = imdbRating && imdbRating.querySelector("span");
                var votes = imdbRating && imdbRating.querySelector("a span");
                if (!score || (!score.textContent) || !votes || (!votes.textContent)) return cb(null, {});
                cb(null, { score: score.textContent, votes: votes.textContent, url: titleUrl });
            });
        });
    }

    function getRating(title, cb) {
            requestRating(title, function(err, rating) {
                if (err) {
                    cb(err);
                } else {
                    cb(null, rating);
                }
            });
    }

    var imdbIconURL = GM_getResourceURL("icon");

    function getOutputFormatter() {
        var div = document.createElement("div");
        div.classList.add("imdb-rating");
        div.style.cursor = "default";
        div.addEventListener("click", function() {});
        var img = document.createElement("img");
        img.classList.add("imdb-image");
        img.src = imdbIconURL;
        div.appendChild(img);
        div.appendChild(document.createElement("div"));
        return function(res) {
            var restDiv = document.createElement("div");
            var rating = res.rating;
            if (res.error) {
                var error = document.createElement("span");
                error.classList.add("imdb-error");
                error.appendChild(document.createTextNode("ERROR"));
                restDiv.appendChild(error);
            } else if (res.loading) {
                var loading = document.createElement("span");
                loading.classList.add("imdb-loading");
                loading.appendChild(document.createTextNode("fetching.."));
                restDiv.appendChild(loading);
            } else if (rating && rating.score && rating.votes && rating.url) {
                var score = document.createElement("span");
                score.classList.add("imdb-score");
                score.appendChild(document.createTextNode(rating.score + "/10"));
                restDiv.appendChild(score);
                var votes = document.createElement("span");
                votes.classList.add("imdb-votes");
                votes.appendChild(document.createTextNode("(" + rating.votes + " votes)"));
                restDiv.appendChild(votes);
                div.addEventListener('click', function() {
                    GM_openInTab(rating.url, { active: true, insert: true, setParent: true });
                });
                div.style.cursor = "pointer";
            } else {
                var noRating = document.createElement("span");
                noRating.classList.add("imdb-no-rating");
                noRating.appendChild(document.createTextNode("N/A"));
                restDiv.appendChild(noRating);
            }
            div.replaceChild(restDiv, div.querySelector("div"));
            return div;
        }
    }

    function getRatingNode(title) {
        var node = document.createElement("div");
        var outputFormatter = getOutputFormatter();
        node.appendChild(outputFormatter({ loading: true }));
        getRating(title, function(err, rating) {
            if (err) return node.appendChild(outputFormatter({ error: true }));
            node.appendChild(outputFormatter({ rating: rating }));
        });
        return node;
    }

    function findAncestor (el, cls) {
        while(el && !el.classList.contains(cls)) {
            el = el.parentNode;
        }
        return el;
    }

    var rootElement = document.getElementById("appMountPoint");

    if (!rootElement) return;

    function imdbRenderingForCard(node) {
        var titleNode = node.querySelector(".bob-title");
        var title = titleNode && titleNode.textContent;
        if (!title) return;
        var ratingNode = getRatingNode(title);
        ratingNode.classList.add("imdb-overlay");
        node.appendChild(ratingNode);
    }

    function imdbRenderingForTrailer(node) {
        var titleNode = node.querySelector(".title-logo");
        var title = titleNode && titleNode.getAttribute("alt");
        if (!title) return;
        var ratingNode = getRatingNode(title);
        titleNode.parentNode.insertBefore(ratingNode, titleNode.nextSibling);
    }

    function imdbRenderingForOverview(node) {
        var text = node.querySelector(".image-fallback-text");
        var logo = node.querySelector(".logo");
        var titleFromText = text && text.textContent;
        var titleFromImage = logo && logo.getAttribute("alt");
        var title = titleFromText || titleFromImage;
        if (!title) return;
        var meta = node.querySelector(".meta");
        if (!meta) return;
        var ratingNode = getRatingNode(title);
        meta.parentNode.insertBefore(ratingNode, meta.nextSibling);
    }

    function imdbRenderingForMoreLikeThis(node) {
        var titleNode = node.querySelector(".video-artwork");
        var title = titleNode && titleNode.getAttribute("alt");
        if (!title) return;
        var meta = node.querySelector(".meta");
        if (!meta) return;
        var ratingNode = getRatingNode(title);
        meta.parentNode.insertBefore(ratingNode, meta.nextSibling);
    }

    function cacheTitleRanking(node) {
        var titleNode = node.querySelector(".fallback-text");
        var title = titleNode && titleNode.textContent;
        if (!title) return;
        getRating(title, function() {});
    }

    var observerCallback = function(mutationsList) {
        for (var i = 0; i < mutationsList.length; i++) {
            var newNodes = mutationsList[i].addedNodes;

            for (var j = 0; j < newNodes.length; j++) {
                var newNode = newNodes[j];
                if (!(newNode instanceof HTMLElement)) continue;

                if (newNode.classList.contains("bob-card")) {
                    imdbRenderingForCard(newNode);
                    continue;
                }

                var trailer = newNode.querySelector(".billboard-row");
                if (trailer) {
                    imdbRenderingForTrailer(trailer);
                    continue;
                }

                var meta = newNode.classList.contains("meta") ? newNode : null;
                meta = meta || newNode.querySelector(".meta");
                if (meta) {
                    var jawBonePane = findAncestor(meta, "jawBonePane");
                    if (jawBonePane && !jawBonePane.classList.contains("js-transition-node")) {
                        if (jawBonePane.id === "pane-Overview") {
                            var jBone = findAncestor(jawBonePane, "jawBone");
                            jBone && imdbRenderingForOverview(jBone);
                        } else if (jawBonePane.id === "pane-MoreLikeThis") {
                            var allSimsLockup = newNode.getElementsByClassName("simsLockup");
                            allSimsLockup && Array.prototype.forEach.call(allSimsLockup, function(node) { imdbRenderingForMoreLikeThis(node); });
                        }
                    }
                    continue;
                }

                var titleCards = newNode.getElementsByClassName("title-card-container");
                if (titleCards) {
                    Array.prototype.forEach.call(titleCards, function(node) { cacheTitleRanking(node); });
                    continue;
                }
            }
        }
    };

    var observer = new MutationObserver(observerCallback);

    var observerConfig = { childList: true, subtree: true };

    observer.observe(document, observerConfig);

    var existingOverview = document.querySelector(".jawBone");
    existingOverview && imdbRenderingForOverview(existingOverview);

    var existingTrailer = document.querySelector(".billboard-row");
    existingTrailer && imdbRenderingForTrailer(existingTrailer);

    window.addEventListener("beforeunload", function () {
        observer.disconnect();
    });
})();