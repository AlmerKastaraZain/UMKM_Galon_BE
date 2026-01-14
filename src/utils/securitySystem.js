// DUMMY ALARM: In the future, this will send an Email or Telegram
exports.sendSilentAlarm = (admin, ip) => {
    console.log("---------- SECURITY ALERT ----------");
    console.log(`ALARM: Root Admin [${admin.email}] logged in!`);
    console.log(`Location/IP: ${ip}`);
    console.log("Action: Notification sent to Owner's private device.");
    console.log("------------------------------------");
    
    // FUTURE: axios.post('https://api.telegram.org/...', { text: 'ALERT: Root Login!' })
};

// DUMMY 2FA: Placeholder for speakeasy verification
exports.verifyTOTP = (submittedCode, savedSecret) => {
    // For now, this is a dummy check. 
    // In production, you'd use: return speakeasy.totp.verify({ secret: savedSecret, token: submittedCode })
    if (submittedCode === "000000") return true; // THE DUMMY CODE
    return false;
};