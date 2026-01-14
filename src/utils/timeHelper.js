exports.getShopStatus = (settings) => {
    const now = new Date();
    // Adjust to WIB (Western Indonesia Time) if your server is in US/Singapore
    const wibTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
    
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(wibTime);
    const currentTime = wibTime.getHours().toString().padStart(2, '0') + ":" + 
                        wibTime.getMinutes().toString().padStart(2, '0');

    // 1. Check Manual Override First
    if (settings.manualOverride.isForcedClosed) {
        return { status: 'FORCED_CLOSED', message: settings.manualOverride.message };
    }

    // 2. Check Weekly Schedule
    const todaySchedule = settings.schedule.find(s => s.day === dayName);
    
    if (!todaySchedule || todaySchedule.isClosed) {
        return { status: 'CLOSED', message: "Toko tutup hari ini." };
    }

    if (currentTime < todaySchedule.openTime) {
        return { status: 'CLOSED_YET', message: `Toko belum buka. Buka jam ${todaySchedule.openTime}` };
    }

    if (currentTime > todaySchedule.closeTime) {
        return { status: 'CLOSED_ALREADY', message: "Toko sudah tutup." };
    }

    return { status: 'OPEN', message: "Toko sedang buka." };
};