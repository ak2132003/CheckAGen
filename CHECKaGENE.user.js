// ==UserScript==
// @name         Family Farm Gift Link Generator
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Generate gift links for Family Farm game with URL shortening and scheduling
// @author       Dr. Ahmed Khaled
// @match        *://*/*
// @updateURL    https://raw.githubusercontent.com/ak2132003/CheckAGen/main/CHECKaGENE.user.js
// @downloadURL  https://raw.githubusercontent.com/ak2132003/CheckAGen/main/CHECKaGENE.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_setClipboard
// @connect      tinyurl.com
// @connect      farm-us.centurygames.com
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @resource     NOTIFICATION_SOUND https://files.catbox.moe/hb2et0.mp3
// ==/UserScript==

(function() {
    'use strict';
    // رابط ملف التحكم عن بُعد
    const controlURL = 'https://raw.githubusercontent.com/ak2132003/Card_Opener/main/control.json';

    try {
        // جلب إعدادات التحكم من ملف JSON
        const response = await fetch(controlURL);
        const controlData = await response.json();

        // تحقق إذا كان السكربت معطلاً
        if (!controlData.enabled) {
            alert(controlData.message || 'تم تعطيل السكربت من قبل المطور.');
            return; // إيقاف تنفيذ السكربت
        }
    } catch (error) {
        console.error('فشل في جلب إعدادات التحكم:', error);
    }

    // Configuration
    const config = {
        sessionDuration: 24 * 60 * 60, // 24 hours in seconds
        maxRetries: 3,
        retryDelay: 1000, // 1 second
        rewardNames: {
            "240895": "حزمة رائعه",
            "240894": "حزمة المبتدئين",
            "204281": "اصفر",
            "207687": "موف",
            "222118": "تى ان تى",
            "100254": "بنزين",
            "209207": "طاقة",
            "222117": "متفجرات",
            "209351": "خضرة",
            "10003": "سماد خارق",
            "205545": "قسيمة خضراء",
            "202747": "تلقائى",
            "10005": "دلو خارق",
            "201966": "تمو ساحر"
        },
        rewardTypes: [
            "t_calendar_everday_reward",
            "t_bingo",
            "t_achieve_achievement_trophy",
            "t_get_mine_goldenChest",
            "t_get_mine_woodenChest",
            "t_get_mysteryshopkeeper",
            "t_get_farmclub_final_reward",
            "t_get_sky_adv_lev",
            "t_get_sky_adv_open",
            "t_get_mine_goldenChest",
            "t_submarine_collect",
            "t_water_ranch_lev"
        ],
        allowedUsers: {
            'walaa': '112233445500',
            'khaled': '01001948570',
            'esraa': '00112233',
            'eldodg': '33221100'
        }
    };

    // State variables
    let schedulerInterval = null;
    let countdownInterval = null;
    let executionCount = 0;
    let nextExecutionTime = 0;
    let totalProcessedLinks = 0;
    let currentProcessing = {
        totalLines: 0,
        processedLines: 0,
        successfulLinks: 0,
        failedLinks: 0,
        partialResults: null,
        isRunning: false,
        stopRequested: false
    };
    let isUIVisible = false;
    let notificationSound = null;

    // Helper functions
    function generateRandomKey(length = 32, signature = "DrKhld") {
        const sigLen = signature.length;
        const remaining = length - sigLen;
        const half = remaining / 2;

        let before = generateRandomString(Math.ceil(half / 2));
        let after = generateRandomString(Math.floor(half / 2));

        before = before.substring(0, half);
        after = after.substring(0, half);

        return before + signature + after;
    }

    function generateRandomString(length) {
        const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function generateComplexAlias(username) {
        const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let randomPart = '';

        for (let i = 0; i < 7; i++) {
            randomPart += chars[Math.floor(Math.random() * chars.length)];
        }

        return username + '-khld-' + randomPart;
    }

    function shortenUrl(originalUrl, alias, callback) {
        let apiUrl = "https://tinyurl.com/api-create.php?url=" + encodeURIComponent(originalUrl);
        if (alias) {
            apiUrl += "&alias=" + encodeURIComponent(alias);
        }

        let retryCount = 0;

        function attempt() {
            GM_xmlhttpRequest({
                method: "GET",
                url: apiUrl,
                onload: function(response) {
                    if (response.status === 200 && response.responseText && isValidUrl(response.responseText)) {
                        callback(response.responseText);
                    } else {
                        retryCount++;
                        if (retryCount < config.maxRetries) {
                            setTimeout(attempt, config.retryDelay);
                        } else {
                            callback("⚠️ لم يتم الاختصار باستخدام TinyURL - ربما الـ alias مستخدم.");
                        }
                    }
                },
                onerror: function() {
                    retryCount++;
                    if (retryCount < config.maxRetries) {
                        setTimeout(attempt, config.retryDelay);
                    } else {
                        callback("⚠️ لم يتم الاختصار باستخدام TinyURL - ربما الـ alias مستخدم.");
                    }
                }
            });
        }

        attempt();
    }

    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    function updateProgressBar() {
        const progressBar = document.getElementById('progressBar');
        const progressPercent = document.getElementById('progressPercent');
        const progressText = document.getElementById('progressText');
        const liveCounter = document.getElementById('liveCounter');

        if (currentProcessing.totalLines > 0) {
            const percent = Math.round((currentProcessing.processedLines / currentProcessing.totalLines) * 100);
            progressBar.style.width = percent + '%';
            progressPercent.textContent = percent + '%';
            progressText.textContent = `تم معالجة ${currentProcessing.processedLines} من ${currentProcessing.totalLines} سطر`;
            liveCounter.textContent = `الروابط الناجحة: ${currentProcessing.successfulLinks} | الروابط الفاشلة: ${currentProcessing.failedLinks}`;
        }
    }

    function processGiftFile(fileContent, username, selectedType, callback) {
        const lines = fileContent.split('\n').filter(line => line.trim() !== '');
        const groupedLinks = {};
        const errors = [];
        let rewardCounters = {};

        currentProcessing = {
            totalLines: lines.length,
            processedLines: 0,
            successfulLinks: 0,
            failedLinks: 0,
            partialResults: null,
            isRunning: true,
            stopRequested: false
        };

        updateProgressBar();

        function processLine(lineNumber, callback) {
            if (currentProcessing.stopRequested || lineNumber >= lines.length) {
                currentProcessing.isRunning = false;

                if (currentProcessing.stopRequested) {
                    const partialResults = {
                        groupedLinks: groupedLinks,
                        errors: errors,
                        processedCount: lineNumber,
                        isPartial: true
                    };
                    GM_setValue('lastPartialResults', JSON.stringify(partialResults));
                }

                callback({
                    groupedLinks: groupedLinks,
                    errors: errors,
                    processedCount: lineNumber,
                    successfulLinks: currentProcessing.successfulLinks,
                    failedLinks: currentProcessing.failedLinks,
                    isPartial: currentProcessing.stopRequested
                });
                return;
            }

            const line = lines[lineNumber];
            const parts = line.split(',');
            if (parts.length !== 2) {
                errors.push("خطأ في السطر " + (lineNumber + 1) + ": تنسيق غير صحيح");
                if (!groupedLinks['غير صالح']) {
                    groupedLinks['غير صالح'] = { raw: [], short: [] };
                    rewardCounters['غير صالح'] = 1;
                }
                groupedLinks['غير صالح'].raw.push(rewardCounters['غير صالح'] + ". ⚠️ تنسيق غير صحيح في السطر " + (lineNumber + 1));
                groupedLinks['غير صالح'].short.push(rewardCounters['غير صالح'] + ". ⚠️ تنسيق غير صحيح في السطر " + (lineNumber + 1));
                rewardCounters['غير صالح']++;
                currentProcessing.processedLines++;
                currentProcessing.failedLinks++;
                updateProgressBar();
                processLine(lineNumber + 1, callback);
                return;
            }

            const uss = parts[0].trim();
            const hash = parts[1].trim();
            const randomSuffix = generateRandomString(8);
            const key = generateRandomKey() + '-KHLD-' + randomSuffix;

            const postData = new URLSearchParams();
            postData.append('uss', uss);
            postData.append('type', selectedType);
            postData.append('key', key);
            postData.append('hash', hash);

            let retryCount = 0;

            function attemptApiCall() {
                GM_xmlhttpRequest({
                    method: "POST",
                    url: "https://farm-us.centurygames.com/index.php/webasync/get_feed_key",
                    data: postData.toString(),
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    onload: function(response) {
                        if (response.status === 200) {
                            try {
                                let json;
                                try {
                                    json = JSON.parse(response.responseText);
                                } catch (e) {
                                    const cleanedResponse = response.responseText.replace(/<[^>]*>?/gm, '');
                                    json = JSON.parse(cleanedResponse);
                                }

                                if (!json || !json.payload) {
                                    errors.push("رد غير صالح لـ uss: " + uss + " (السطر " + (lineNumber + 1) + ")");
                                    if (!groupedLinks['غير صالح']) {
                                        groupedLinks['غير صالح'] = { raw: [], short: [] };
                                        rewardCounters['غير صالح'] = 1;
                                    }
                                    groupedLinks['غير صالح'].raw.push(rewardCounters['غير صالح'] + ". ⚠️ USS غير صالح: " + uss + " (السطر " + (lineNumber + 1) + ")");
                                    groupedLinks['غير صالح'].short.push(rewardCounters['غير صالح'] + ". ⚠️ USS غير صالح: " + uss + " (السطر " + (lineNumber + 1) + ")");
                                    rewardCounters['غير صالح']++;
                                    currentProcessing.processedLines++;
                                    currentProcessing.failedLinks++;
                                    updateProgressBar();
                                    processLine(lineNumber + 1, callback);
                                    return;
                                }

                                const payload = json.payload;
                                const type = payload.type || 'غير معروف';
                                const snsid = payload.snsid || 'غير معروف';
                                const rewardCode = (payload.reward && payload.reward.items) ? payload.reward.items.split(':')[0] : '';
                                const rewardName = config.rewardNames[rewardCode] || 'غير معروف';

                                const link = "https://apps.facebook.com/family-farm/ar/facebook/get_reward/?vk=" + key + "_" + snsid + "___" + type;
                                const alias = generateComplexAlias(username);

                                shortenUrl(link, alias, function(short) {
                                    if (!groupedLinks[rewardName]) {
                                        groupedLinks[rewardName] = { raw: [], short: [] };
                                        rewardCounters[rewardName] = 1;
                                    }
                                    groupedLinks[rewardName].raw.push(rewardCounters[rewardName] + ". " + link);
                                    groupedLinks[rewardName].short.push(rewardCounters[rewardName] + ". " + short);
                                    rewardCounters[rewardName]++;
                                    currentProcessing.processedLines++;
                                    currentProcessing.successfulLinks++;
                                    updateProgressBar();
                                    processLine(lineNumber + 1, callback);
                                });
                            } catch (e) {
                                errors.push("خطأ في معالجة الرد لـ uss: " + uss + " (السطر " + (lineNumber + 1) + ") - " + e.message);
                                if (!groupedLinks['غير صالح']) {
                                    groupedLinks['غير صالح'] = { raw: [], short: [] };
                                    rewardCounters['غير صالح'] = 1;
                                }
                                groupedLinks['غير صالح'].raw.push(rewardCounters['غير صالح'] + ". ⚠️ USS غير صالح: " + uss + " (السطر " + (lineNumber + 1) + ")");
                                groupedLinks['غير صالح'].short.push(rewardCounters['غير صالح'] + ". ⚠️ USS غير صالح: " + uss + " (السطر " + (lineNumber + 1) + ")");
                                rewardCounters['غير صالح']++;
                                currentProcessing.processedLines++;
                                currentProcessing.failedLinks++;
                                updateProgressBar();
                                processLine(lineNumber + 1, callback);
                            }
                        } else {
                            retryCount++;
                            if (retryCount < config.maxRetries) {
                                setTimeout(attemptApiCall, config.retryDelay);
                            } else {
                                errors.push("فشل في الاتصال لـ uss: " + uss + " (السطر " + (lineNumber + 1) + ")");
                                if (!groupedLinks['غير صالح']) {
                                    groupedLinks['غير صالح'] = { raw: [], short: [] };
                                    rewardCounters['غير صالح'] = 1;
                                }
                                groupedLinks['غير صالح'].raw.push(rewardCounters['غير صالح'] + ". ⚠️ USS غير صالح: " + uss + " (السطر " + (lineNumber + 1) + ")");
                                groupedLinks['غير صالح'].short.push(rewardCounters['غير صالح'] + ". ⚠️ USS غير صالح: " + uss + " (السطر " + (lineNumber + 1) + ")");
                                rewardCounters['غير صالح']++;
                                currentProcessing.processedLines++;
                                currentProcessing.failedLinks++;
                                updateProgressBar();
                                processLine(lineNumber + 1, callback);
                            }
                        }
                    },
                    onerror: function() {
                        retryCount++;
                        if (retryCount < config.maxRetries) {
                            setTimeout(attemptApiCall, config.retryDelay);
                        } else {
                            errors.push("فشل في الاتصال لـ uss: " + uss + " (السطر " + (lineNumber + 1) + ")");
                            if (!groupedLinks['غير صالح']) {
                                groupedLinks['غير صالح'] = { raw: [], short: [] };
                                rewardCounters['غير صالح'] = 1;
                            }
                            groupedLinks['غير صالح'].raw.push(rewardCounters['غير صالح'] + ". ⚠️ USS غير صالح: " + uss + " (السطر " + (lineNumber + 1) + ")");
                            groupedLinks['غير صالح'].short.push(rewardCounters['غير صالح'] + ". ⚠️ USS غير صالح: " + uss + " (السطر " + (lineNumber + 1) + ")");
                            rewardCounters['غير صالح']++;
                            currentProcessing.processedLines++;
                            currentProcessing.failedLinks++;
                            updateProgressBar();
                            processLine(lineNumber + 1, callback);
                        }
                    }
                });
            }

            attemptApiCall();
        }

        processLine(0, callback);
    }

    function generateResultTexts(groupedLinks) {
        let resultText = "";
        let shortenedText = "";
        let rawLinksText = "";

        for (const reward in groupedLinks) {
            const count = groupedLinks[reward].raw.length;
            resultText += "🎁 " + reward + " (" + count + ")\n";
            shortenedText += "🎁 " + reward + " (" + count + ")\n";
            rawLinksText += "🎁 " + reward + " (" + count + ")\n";

            groupedLinks[reward].raw.forEach(link => rawLinksText += link + "\n");
            groupedLinks[reward].short.forEach(link => shortenedText += link + "\n");

            resultText += "\n";
            shortenedText += "\n";
            rawLinksText += "\n";
        }

        return {
            resultText: resultText,
            shortenedText: shortenedText,
            rawLinksText: rawLinksText
        };
    }

    function saveResultsToFiles(username, resultTexts, errors, isPartial = false) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
        const usernameDisplay = username || 'unknown';
        const prefix = isPartial ? 'partial_results_' : '';

        const files = {
            short: prefix + "short_links_" + usernameDisplay + "_" + timestamp + ".txt",
            raw: prefix + "raw_links_" + usernameDisplay + "_" + timestamp + ".txt",
            combined: prefix + "combined_results_" + usernameDisplay + "_" + timestamp + ".txt",
            error: errors.length > 0 ? prefix + "errors_" + usernameDisplay + "_" + timestamp + ".txt" : null
        };

        // Auto-download files
        GM_download({
            url: "data:text/plain;charset=utf-8," + encodeURIComponent(resultTexts.shortenedText),
            name: files.short,
            saveAs: false
        });

        GM_download({
            url: "data:text/plain;charset=utf-8," + encodeURIComponent(resultTexts.rawLinksText),
            name: files.raw,
            saveAs: false
        });

        GM_download({
            url: "data:text/plain;charset=utf-8," + encodeURIComponent("=== روابط مختصرة ===\n" + resultTexts.shortenedText + "\n\n=== روابط أصلية ===\n" + resultTexts.rawLinksText),
            name: files.combined,
            saveAs: false
        });

        if (files.error) {
            GM_download({
                url: "data:text/plain;charset=utf-8," + encodeURIComponent("=== الأخطاء ===\n" + errors.join("\n")),
                name: files.error,
                saveAs: false
            });
        }

        // Also create download links for manual download
        function createDownloadLink(content, filename) {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            return URL.createObjectURL(blob);
        }

        const shortUrl = createDownloadLink(resultTexts.shortenedText, files.short);
        const rawUrl = createDownloadLink(resultTexts.rawLinksText, files.raw);
        const combinedUrl = createDownloadLink("=== روابط مختصرة ===\n" + resultTexts.shortenedText + "\n\n=== روابط أصلية ===\n" + resultTexts.rawLinksText, files.combined);

        return {
            short: { name: files.short, url: shortUrl },
            raw: { name: files.raw, url: rawUrl },
            combined: { name: files.combined, url: combinedUrl },
            error: files.error ? {
                name: files.error,
                url: createDownloadLink("=== الأخطاء ===\n" + errors.join("\n"), files.error)
            } : null
        };
    }

    function createFloatingButton() {
        const button = document.createElement('div');
        button.id = 'giftGeneratorButton';
        button.title = 'أداة توليد روابط الهدايا';

        button.style.position = 'fixed';
        button.style.bottom = '20px';
        button.style.right = '20px';
        button.style.width = '40px';
        button.style.height = '40px';
        button.style.backgroundColor = '#3498db';
        button.style.borderRadius = '50%';
        button.style.color = 'white';
        button.style.textAlign = 'center';
        button.style.lineHeight = '40px';
        button.style.fontSize = '20px';
        button.style.cursor = 'pointer';
        button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        button.style.zIndex = '10000';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';

        const icon = document.createElement('span');
        icon.textContent = '🎁';
        icon.style.fontSize = '22px';
        button.appendChild(icon);

        button.addEventListener('click', toggleUI);

        document.body.appendChild(button);
    }

    function toggleUI() {
        const container = document.getElementById('giftGeneratorContainer');
        if (isUIVisible) {
            container.style.display = 'none';
            isUIVisible = false;
        } else {
            container.style.display = 'block';
            isUIVisible = true;
        }
    }

    function playNotificationSound() {
        if (!notificationSound) {
            notificationSound = new Audio("https://files.catbox.moe/hb2et0.mp3");
        }

        try {
            notificationSound.currentTime = 0;
            notificationSound.play().catch(e => console.log("Could not play sound:", e));
        } catch (e) {
            console.log("Error playing sound:", e);
        }
    }

    function testNotificationSound() {
        const testSound = new Audio("https://files.catbox.moe/hb2et0.mp3");
        testSound.play().catch(e => {
            console.log("Could not play test sound:", e);
            showError("تعذر تشغيل صوت الاختبار. يرجى التحقق من إعدادات المتصفح.");
        });
    }

    function createUI() {
        const style = `
            #giftGeneratorContainer {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 500px;
                max-width: 95%;
                max-height: 90vh;
                overflow-y: auto;
                background-color: white;
                border-radius: 10px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                z-index: 10000;
                display: none;
                padding: 15px;
                font-family: 'Tajawal', Arial, sans-serif;
                direction: rtl;
                border: 1px solid #ddd;
            }

            #giftGeneratorContainer .close-btn {
                position: absolute;
                top: 5px;
                left: 5px;
                font-size: 18px;
                cursor: pointer;
                background: #e74c3c;
                color: white;
                width: 25px;
                height: 25px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 25px;
            }

            #giftGeneratorContainer h1 {
                font-size: 1.5rem;
                margin: 0 0 10px 0;
                color: #2c3e50;
                text-align: center;
            }

            #giftGeneratorContainer h2 {
                font-size: 1rem;
                margin: 0 0 20px 0;
                color: #7f8c8d;
                text-align: center;
                font-weight: normal;
            }

            #giftGeneratorContainer .form-group {
                margin-bottom: 15px;
            }

            #giftGeneratorContainer label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
                color: #2c3e50;
                font-size: 0.9rem;
            }

            #giftGeneratorContainer input,
            #giftGeneratorContainer select {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 5px;
                font-size: 0.9rem;
                transition: all 0.2s;
            }

            #giftGeneratorContainer input:focus,
            #giftGeneratorContainer select:focus {
                border-color: #3498db;
                box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
                outline: none;
            }

            #giftGeneratorContainer .btn {
                background: #3498db;
                color: white;
                border: none;
                padding: 8px 15px;
                font-size: 0.9rem;
                border-radius: 5px;
                cursor: pointer;
                width: 100%;
                transition: all 0.2s;
                margin: 5px 0;
                text-align: center;
            }

            #giftGeneratorContainer .btn:hover {
                background: #2980b9;
            }

            #giftGeneratorContainer .btn-secondary {
                background: #2ecc71;
            }

            #giftGeneratorContainer .btn-secondary:hover {
                background: #27ae60;
            }

            #giftGeneratorContainer .btn-danger {
                background: #e74c3c;
            }

            #giftGeneratorContainer .btn-danger:hover {
                background: #c0392b;
            }

            #giftGeneratorContainer .btn-warning {
                background: #f39c12;
            }

            #giftGeneratorContainer .btn-warning:hover {
                background: #e67e22;
            }

            #giftGeneratorContainer .file-input {
                position: relative;
                margin-bottom: 15px;
            }

            #giftGeneratorContainer .file-input label {
                display: block;
                padding: 8px 12px;
                background: #f8f9fa;
                border: 1px dashed #ddd;
                border-radius: 5px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 0.9rem;
            }

            #giftGeneratorContainer .file-input label:hover {
                background: #e9ecef;
                border-color: #3498db;
            }

            #giftGeneratorContainer .file-input input[type="file"] {
                position: absolute;
                opacity: 0;
                width: 100%;
                height: 100%;
                top: 0;
                left: 0;
                cursor: pointer;
            }

            #giftGeneratorContainer .file-name {
                margin-top: 5px;
                font-size: 0.8rem;
                color: #666;
                text-align: center;
            }

            #giftGeneratorContainer .progress-container {
                margin: 15px 0;
                background-color: #f1f1f1;
                border-radius: 5px;
                height: 15px;
                overflow: hidden;
                display: none;
            }

            #giftGeneratorContainer .progress-bar {
                height: 100%;
                background-color: #2ecc71;
                width: 0%;
                transition: width 0.3s ease;
            }

            #giftGeneratorContainer .progress-info {
                display: flex;
                justify-content: space-between;
                margin-top: 5px;
                font-size: 0.8rem;
                display: none;
            }

            #giftGeneratorContainer .live-counter {
                text-align: center;
                margin: 10px 0;
                font-size: 0.9rem;
                color: #3498db;
                display: none;
            }

            #giftGeneratorContainer .emergency-stop {
                display: none;
                margin-top: 10px;
            }

            #giftGeneratorContainer .loading {
                display: none;
                text-align: center;
                padding: 20px 0;
            }

            #giftGeneratorContainer .loading img {
                width: 50px;
                height: 50px;
            }

            #giftGeneratorContainer .loading p {
                margin-top: 10px;
                font-size: 0.9rem;
                color: #2c3e50;
            }

            #giftGeneratorContainer .results {
                display: none;
                margin-top: 15px;
            }

            #giftGeneratorContainer .tabs {
                display: flex;
                border-bottom: 1px solid #ddd;
                margin-bottom: 10px;
            }

            #giftGeneratorContainer .tab {
                padding: 8px 15px;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
                font-size: 0.9rem;
            }

            #giftGeneratorContainer .tab.active {
                border-bottom-color: #3498db;
                color: #3498db;
                font-weight: 500;
            }

            #giftGeneratorContainer .tab-content {
                display: none;
                background: #f8f9fa;
                padding: 10px;
                border-radius: 5px;
                max-height: 200px;
                overflow-y: auto;
                font-size: 0.8rem;
                white-space: pre-wrap;
            }

            #giftGeneratorContainer .tab-content.active {
                display: block;
            }

            #giftGeneratorContainer .download-buttons {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin-top: 10px;
            }

            #giftGeneratorContainer .download-buttons a {
                flex: 1 1 45%;
                min-width: 0;
                font-size: 0.8rem;
                padding: 6px 10px;
            }

            #giftGeneratorContainer .error {
                background-color: #fdecea;
                color: #e74c3c;
                padding: 10px;
                border-radius: 5px;
                margin-top: 10px;
                border-left: 3px solid #e74c3c;
                font-size: 0.9rem;
                display: none;
            }

            #giftGeneratorContainer .success {
                background-color: #e8f5e9;
                color: #2e7d32;
                padding: 10px;
                border-radius: 5px;
                margin-top: 10px;
                border-left: 3px solid #2e7d32;
                font-size: 0.9rem;
                display: none;
                text-align: center;
            }

            #giftGeneratorContainer .schedule-section {
                background: #f8f9fa;
                padding: 10px;
                border-radius: 5px;
                margin-bottom: 15px;
                border: 1px solid #ddd;
            }

            #giftGeneratorContainer .schedule-section h3 {
                margin: 0 0 10px 0;
                font-size: 1rem;
                color: #2c3e50;
            }

            #giftGeneratorContainer .schedule-option {
                margin-bottom: 10px;
            }

            #giftGeneratorContainer .schedule-option label {
                display: inline;
                margin-right: 10px;
            }

            #giftGeneratorContainer #scheduleOptions {
                display: none;
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #ddd;
            }

            #giftGeneratorContainer .time-inputs {
                display: flex;
                gap: 10px;
                margin-top: 10px;
            }

            #giftGeneratorContainer .time-inputs .form-group {
                flex: 1;
                margin-bottom: 0;
            }

            #giftGeneratorContainer .countdown-container {
                display: none;
                background: #e3f2fd;
                padding: 10px;
                border-radius: 5px;
                margin-top: 10px;
                text-align: center;
                font-size: 0.9rem;
            }

            #giftGeneratorContainer .countdown {
                font-weight: bold;
                color: #3498db;
            }

            #giftGeneratorContainer .execution-log {
                display: none;
                background: #f5f5f5;
                padding: 10px;
                border-radius: 5px;
                margin-top: 10px;
                max-height: 150px;
                overflow-y: auto;
                font-size: 0.8rem;
            }

            #giftGeneratorContainer .log-entry {
                padding: 5px 0;
                border-bottom: 1px solid #ddd;
                font-size: 0.8rem;
            }

            #giftGeneratorContainer .log-entry:last-child {
                border-bottom: none;
            }

            #giftGeneratorContainer .counter-display {
                font-size: 0.9rem;
                color: #2ecc71;
                text-align: center;
                margin: 10px 0;
                font-weight: bold;
            }

            #giftGeneratorContainer .partial-results-notice {
                background-color: #fff3cd;
                color: #856404;
                padding: 10px;
                border-radius: 5px;
                margin-top: 10px;
                border-left: 3px solid #ffeeba;
                display: none;
                cursor: pointer;
                font-size: 0.9rem;
            }

            #giftGeneratorContainer .footer {
                text-align: center;
                margin-top: 15px;
                padding-top: 10px;
                color: #666;
                font-size: 0.8rem;
                border-top: 1px solid #eee;
            }

            @media (max-width: 500px) {
                #giftGeneratorContainer {
                    width: 95%;
                    padding: 10px;
                }

                #giftGeneratorContainer .download-buttons a {
                    flex: 1 1 100%;
                }

                #giftGeneratorContainer .time-inputs {
                    flex-direction: column;
                    gap: 5px;
                }
            }
        `;

        const html = `
            <div id="giftGeneratorContainer">
                <div class="close-btn" id="closeUI">×</div>
                <h1>نظام توليد روابط الهدايا</h1>
                <h2>بواسطة د. أحمد خالد | إصدار 3.0</h2>

                <form id="mainForm">
                    <div class="form-group file-input">
                        <label>📁 اختر ملف الهدايا (يجب أن يحتوي على uss, hash)</label>
                        <label for="giftfile">اسحب وأسقط الملف هنا أو انقر للاختيار</label>
                        <input type="file" name="giftfile" id="giftfile" accept=".txt" required>
                        <div class="file-name" id="fileName">لم يتم اختيار ملف</div>
                    </div>

                    <div class="form-group">
                        <label>👤 اسم المستخدم</label>
                        <input type="text" name="username" placeholder="أدخل اسم المستخدم" required>
                    </div>

                    <div class="form-group">
                        <label>🔒 كلمة المرور</label>
                        <input type="password" name="password" placeholder="أدخل كلمة المرور" required>
                    </div>

                    <div class="form-group">
                        <label>⚙️ نوع الهدية</label>
                        <select name="type" required>
                            ${config.rewardTypes.map(type => `<option value="${type}">${type}</option>`).join('')}
                        </select>
                    </div>

                    <div class="schedule-section">
                        <h3>⏰ جدولة التكرار التلقائي</h3>
                        <div class="schedule-option">
                            <input type="checkbox" id="enableSchedule" name="enableSchedule">
                            <label for="enableSchedule">تمكين الجدولة التلقائية</label>
                        </div>

                        <div id="scheduleOptions">
                            <div class="time-inputs">
                                <div class="form-group">
                                    <label>عدد الساعات:</label>
                                    <input type="number" name="hours" min="0" value="0">
                                </div>
                                <div class="form-group">
                                    <label>عدد الدقائق:</label>
                                    <input type="number" name="minutes" min="1" value="30">
                                </div>
                            </div>
                            <button type="button" class="btn btn-warning" id="testSound">🔊 اختبار صوت التنبيه</button>
                        </div>
                    </div>

                    <div class="counter-display" id="counterDisplay">
                        الروابط المعالجة: <span id="processedCount">0</span>
                    </div>

                    <div class="progress-container" id="progressContainer">
                        <div class="progress-bar" id="progressBar"></div>
                    </div>
                    <div class="progress-info" id="progressInfo">
                        <span id="progressPercent">0%</span>
                        <span id="progressText"></span>
                    </div>
                    <div class="live-counter" id="liveCounter"></div>

                    <button type="submit" class="btn btn-secondary">🚀 بدء توليد الروابط</button>
                    <button type="button" class="btn btn-danger" id="stopSchedule">⏹ إيقاف الجدولة</button>
                    <button type="button" class="emergency-stop" id="emergencyStop">🛑 توقف طارئ وحفظ النتائج الحالية</button>
                </form>

                <div class="partial-results-notice" id="partialResultsNotice">
                    ⚠️ هذه نتائج جزئية من آخر عملية تم إيقافها. يمكنك استكمال المعالجة أو تحميل النتائج الحالية.
                </div>

                <div class="countdown-container" id="countdownContainer">
                    <div class="countdown">الوقت المتبقي للتنفيذ التالي: <span id="countdown">00:00:00</span></div>
                </div>

                <div class="execution-log" id="executionLog">
                    <h3>📝 سجل التنفيذ</h3>
                    <div id="logEntries"></div>
                </div>

                <div class="loading" id="loading">
                    <img src="https://i.gifer.com/ZZ5H.gif" alt="جاري التحميل">
                    <p>جاري معالجة طلبك، الرجاء الانتظار...</p>
                </div>

                <div class="success" id="successMessage">
                    ✅ تم تنفيذ العملية بنجاح
                </div>

                <div class="error" id="errorMessage"></div>

                <div class="results" id="results">
                    <div class="tabs">
                        <div class="tab active" data-tab="result">النتائج</div>
                        <div class="tab" data-tab="shortened">الروابط المختصرة</div>
                        <div class="tab" data-tab="raw">الروابط الأصلية</div>
                        <div class="tab" data-tab="errors" id="errorsTab" style="display: none;">الأخطاء</div>
                    </div>

                    <div class="tab-content active" id="resultTab"></div>
                    <div class="tab-content" id="shortenedTab"></div>
                    <div class="tab-content" id="rawTab"></div>
                    <div class="tab-content" id="errorsTabContent"></div>

                    <div class="download-buttons">
                        <a href="#" class="btn" id="downloadShort">تحميل الروابط المختصرة</a>
                        <a href="#" class="btn" id="downloadRaw">تحميل الروابط الأصلية</a>
                        <a href="#" class="btn btn-secondary" id="downloadCombined">تحميل كل النتائج</a>
                        <a href="#" class="btn btn-danger" id="downloadErrors" style="display: none;">تحميل ملف الأخطاء</a>
                    </div>
                </div>

                <div class="footer">
                    <p>جميع الحقوق محفوظة &copy; ${new Date().getFullYear()} | د. أحمد خالد</p>
                </div>
            </div>
        `;

        // Add styles to the page
        const styleElement = document.createElement('style');
        styleElement.textContent = style;
        document.head.appendChild(styleElement);

        // Add HTML to the page
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container);

        // Create floating button
        createFloatingButton();

        // Close button event
        document.getElementById('closeUI').addEventListener('click', toggleUI);

        // Check for partial results from previous session
        const lastPartialResults = GM_getValue('lastPartialResults', null);
        if (lastPartialResults) {
            document.getElementById('partialResultsNotice').style.display = 'block';
        }

        // Initialize UI events
        initUIEvents();
    }

    function initUIEvents() {
        // Display selected file name
        document.getElementById('giftfile').addEventListener('change', function(e) {
            const fileName = e.target.files[0] ? e.target.files[0].name : 'لم يتم اختيار ملف';
            document.getElementById('fileName').textContent = fileName;
        });

        // Show/hide schedule options
        document.getElementById('enableSchedule').addEventListener('change', function() {
            document.getElementById('scheduleOptions').style.display = this.checked ? 'block' : 'none';
        });

        // Save user data to storage
        document.querySelector('[name="username"]').addEventListener('change', function() {
            GM_setValue('username', this.value);
        });

        document.querySelector('[name="password"]').addEventListener('change', function() {
            GM_setValue('password', this.value);
        });

        document.querySelector('[name="type"]').addEventListener('change', function() {
            GM_setValue('type', this.value);
        });

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');

                // Remove active class from all tabs and contents
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                // Add active class to selected tab and content
                this.classList.add('active');
                document.getElementById(tabId + 'Tab').classList.add('active');
            });
        });

        // Test notification sound
        document.getElementById('testSound').addEventListener('click', testNotificationSound);

        // Load saved data
        const savedUsername = GM_getValue('username', '');
        const savedPassword = GM_getValue('password', '');
        const savedType = GM_getValue('type', config.rewardTypes[0]);

        if (savedUsername) document.querySelector('[name="username"]').value = savedUsername;
        if (savedPassword) document.querySelector('[name="password"]').value = savedPassword;
        if (savedType) document.querySelector('[name="type"]').value = savedType;

        // Form submission
        document.getElementById('mainForm').addEventListener('submit', function(e) {
            e.preventDefault();

            const username = document.querySelector('[name="username"]').value.trim().toLowerCase();
            const password = document.querySelector('[name="password"]').value.trim();
            const selectedType = document.querySelector('[name="type"]').value;
            const fileInput = document.getElementById('giftfile');
            const enableSchedule = document.getElementById('enableSchedule').checked;

            // Validate credentials
            if (!config.allowedUsers[username] || config.allowedUsers[username] !== password) {
                showError("🚫 اسم المستخدم أو كلمة المرور غير صحيحة.");
                return;
            }

            // Validate file
            if (!fileInput.files || fileInput.files.length === 0) {
                showError("⚠️ يرجى اختيار ملف الهدايا");
                return;
            }

            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = function(e) {
                const fileContent = e.target.result;

                if (enableSchedule) {
                    // Show scheduling elements
                    document.getElementById('stopSchedule').style.display = 'block';
                    document.getElementById('countdownContainer').style.display = 'block';
                    document.getElementById('executionLog').style.display = 'block';
                    document.getElementById('emergencyStop').style.display = 'block';

                    // Execute first time and schedule next executions after completion
                    processFile(fileContent, username, selectedType, function() {
                        const intervalMs = getIntervalMs();
                        nextExecutionTime = Date.now() + intervalMs;

                        // Start countdown after first execution
                        startCountdown(intervalMs);

                        // Schedule next executions
                        schedulerInterval = setInterval(() => {
                            processFile(fileContent, username, selectedType, function() {
                                const newIntervalMs = getIntervalMs();
                                nextExecutionTime = Date.now() + newIntervalMs;
                                startCountdown(newIntervalMs);
                            });
                        }, intervalMs);
                    });
                } else {
                    // One-time processing
                    document.getElementById('emergencyStop').style.display = 'block';
                    processFile(fileContent, username, selectedType);
                }
            };

            reader.readAsText(file);
        });

        // Stop scheduling button
        document.getElementById('stopSchedule').addEventListener('click', function() {
            stopScheduling();
            addLogEntry("⏹ توقفت الجدولة التلقائية بواسطة المستخدم");
        });

        // Emergency stop button
        document.getElementById('emergencyStop').addEventListener('click', function() {
            currentProcessing.stopRequested = true;
            document.getElementById('emergencyStop').style.display = 'none';
            addLogEntry("🛑 تم إيقاف العملية بشكل طارئ وحفظ النتائج الحالية");
        });

        // Load partial results button
        document.getElementById('partialResultsNotice').addEventListener('click', function() {
            const lastPartialResults = GM_getValue('lastPartialResults', null);
            if (lastPartialResults) {
                try {
                    const results = JSON.parse(lastPartialResults);
                    displayResults(results, true);
                    GM_setValue('lastPartialResults', null);
                    document.getElementById('partialResultsNotice').style.display = 'none';
                } catch (e) {
                    showError("حدث خطأ في تحميل النتائج الجزئية السابقة");
                }
            }
        });
    }

    function getIntervalMs() {
        const hours = parseInt(document.querySelector('[name="hours"]').value) || 0;
        const minutes = parseInt(document.querySelector('[name="minutes"]').value) || 30;

        return (hours * 3600000) + (minutes * 60000);
    }

    function startCountdown(ms) {
        clearInterval(countdownInterval);
        nextExecutionTime = Date.now() + ms;

        function updateCountdown() {
            const now = Date.now();
            const remaining = nextExecutionTime - now;

            if (remaining <= 0) {
                clearInterval(countdownInterval);
                document.getElementById('countdown').textContent = "00:00:00";
                playNotificationSound();
                return;
            }

            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

            document.getElementById('countdown').textContent =
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);
    }

    function stopScheduling() {
        if (schedulerInterval) {
            clearInterval(schedulerInterval);
            clearInterval(countdownInterval);
            schedulerInterval = null;
            countdownInterval = null;
        }

        document.getElementById('stopSchedule').style.display = 'none';
        document.getElementById('countdownContainer').style.display = 'none';
        document.getElementById('executionLog').style.display = 'none';
        document.getElementById('emergencyStop').style.display = 'none';
    }

    function updateProcessedCount(count) {
        totalProcessedLinks += count;
        document.getElementById('processedCount').textContent = totalProcessedLinks;
    }

    function addLogEntry(message, files = {}) {
        executionCount++;
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';

        let logContent = `<strong>التنفيذ #${executionCount}</strong> - ${new Date().toLocaleString()}<br>${message}`;

        if (files.short) {
            logContent += `<br><a href="${files.short.url}" download="${files.short.name}">تحميل الروابط المختصرة</a>`;
        }
        if (files.raw) {
            logContent += ` | <a href="${files.raw.url}" download="${files.raw.name}">تحميل الروابط الأصلية</a>`;
        }
        if (files.combined) {
            logContent += ` | <a href="${files.combined.url}" download="${files.combined.name}">تحميل كل النتائج</a>`;
        }
        if (files.error) {
            logContent += ` | <a href="${files.error.url}" download="${files.error.name}">تحميل ملف الأخطاء</a>`;
        }

        logEntry.innerHTML = logContent;
        document.getElementById('logEntries').prepend(logEntry);
    }

    function showError(message) {
        const errorElement = document.getElementById('errorMessage');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }

    function displayResults(result, isPartial = false) {
        const loadingElement = document.getElementById('loading');
        const resultsElement = document.getElementById('results');
        const successElement = document.getElementById('successMessage');
        const errorElement = document.getElementById('errorMessage');

        loadingElement.style.display = 'none';

        // Generate result texts
        const resultTexts = generateResultTexts(result.groupedLinks);

        // Save results to files
        const files = saveResultsToFiles(GM_getValue('username', ''), resultTexts, result.errors, isPartial);

        // Update processed count
        if (result.processedCount) {
            updateProcessedCount(result.processedCount);
        }

        // Display results
        document.getElementById('resultTab').textContent = resultTexts.resultText || "لا توجد نتائج";
        document.getElementById('shortenedTab').textContent = resultTexts.shortenedText || "لا توجد روابط مختصرة";
        document.getElementById('rawTab').textContent = resultTexts.rawLinksText || "لا توجد روابط أصلية";

        // Display errors if any
        if (result.errors && result.errors.length > 0) {
            document.getElementById('errorsTab').style.display = 'block';
            document.getElementById('downloadErrors').style.display = 'block';
            document.getElementById('errorsTabContent').textContent = result.errors.join('\n');
        } else {
            document.getElementById('errorsTab').style.display = 'none';
            document.getElementById('downloadErrors').style.display = 'none';
        }

        // Set download links
        document.getElementById('downloadShort').href = files.short.url;
        document.getElementById('downloadShort').download = files.short.name;
        document.getElementById('downloadShort').textContent = `تحميل ${files.short.name}`;

        document.getElementById('downloadRaw').href = files.raw.url;
        document.getElementById('downloadRaw').download = files.raw.name;
        document.getElementById('downloadRaw').textContent = `تحميل ${files.raw.name}`;

        document.getElementById('downloadCombined').href = files.combined.url;
        document.getElementById('downloadCombined').download = files.combined.name;
        document.getElementById('downloadCombined').textContent = `تحميل ${files.combined.name}`;

        if (files.error) {
            document.getElementById('downloadErrors').href = files.error.url;
            document.getElementById('downloadErrors').download = files.error.name;
            document.getElementById('downloadErrors').textContent = `تحميل ${files.error.name}`;
            document.getElementById('downloadErrors').style.display = 'block';
        }

        // Show results and success message
        resultsElement.style.display = 'block';
        if (!isPartial) {
            successElement.style.display = 'block';
        }

        // Add to execution log
        addLogEntry(isPartial ? "تم حفظ النتائج الجزئية" : "تم تنفيذ العملية بنجاح", files);

        // Play notification sound
        playNotificationSound();

        // Hide success message after 5 seconds
        setTimeout(() => {
            successElement.style.display = 'none';
        }, 5000);

        // Hide progress elements
        document.getElementById('progressContainer').style.display = 'none';
        document.getElementById('progressInfo').style.display = 'none';
        document.getElementById('liveCounter').style.display = 'none';
        document.getElementById('emergencyStop').style.display = 'none';
    }

    function processFile(fileContent, username, selectedType, callback) {
        const loadingElement = document.getElementById('loading');
        const resultsElement = document.getElementById('results');
        const successElement = document.getElementById('successMessage');
        const errorElement = document.getElementById('errorMessage');

        // Show loading state and hide previous results
        loadingElement.style.display = 'block';
        resultsElement.style.display = 'none';
        successElement.style.display = 'none';
        errorElement.style.display = 'none';

        // Show progress elements
        document.getElementById('progressContainer').style.display = 'block';
        document.getElementById('progressInfo').style.display = 'block';
        document.getElementById('liveCounter').style.display = 'block';

        processGiftFile(fileContent, username, selectedType, function(result) {
            displayResults(result, result.isPartial);
            if (callback) callback();
        });
    }

    // Initialize the UI when the script loads
    createUI();
})();
