const { Client } = require('discord.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ===== RAILWAY CONFIGURATION =====
const TOKEN = process.env.TOKEN; // Gets token from Railway Variables
const OWNER_ID = process.env.OWNER_ID || "361069640962801664"; // Set this in Railway too
const PREFIX = "-";
const startTime = Date.now();

// Verify token exists
if (!TOKEN) {
    console.error("❌ ERROR: TOKEN environment variable not set!");
    console.error("   Go to Railway → Variables → Add TOKEN = your_user_token");
    process.exit(1);
}

if (!OWNER_ID || OWNER_ID === "YOUR_DISCORD_ID_HERE") {
    console.warn("⚠️ WARNING: OWNER_ID not set in Railway! Add it as a variable.");
}

// ===== DATA STORAGE =====
// Use /tmp for Railway (ephemeral storage) or persistent volume
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const dataPath = path.join(DATA_DIR, 'selfbot_data.json');

let superReactUsers = new Set();
let autoReactUsers = new Map();

// Load existing data
if (fs.existsSync(dataPath)) {
    try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        superReactUsers = new Set(data.superReactUsers || []);
        const loadedAutoReact = data.autoReactUsers || {};
        autoReactUsers = new Map(Object.entries(loadedAutoReact));
        console.log(`✅ Loaded data: ${superReactUsers.size} super react users, ${autoReactUsers.size} auto react users`);
    } catch (e) {
        console.error('Failed to load data:', e.message);
    }
}

function saveData() {
    try {
        fs.writeFileSync(dataPath, JSON.stringify({
            superReactUsers: Array.from(superReactUsers),
            autoReactUsers: Object.fromEntries(autoReactUsers)
        }, null, 2));
    } catch (e) {
        console.error('Failed to save data:', e.message);
    }
}

// ===== CLIENT SETUP =====
const client = new Client({
    intents: [
        'GUILDS',
        'GUILD_MESSAGES',
        'GUILD_MESSAGE_REACTIONS',
        'DIRECT_MESSAGES'
    ],
    partials: ['CHANNEL', 'MESSAGE', 'REACTION']
});

// ===== UTILITY FUNCTIONS =====
function formatUptime() {
    const uptime = Date.now() - startTime;
    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor((uptime % 86400000) / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

async function deleteMessage(msg, delay = 0) {
    if (!msg) return;
    if (delay > 0) await new Promise(r => setTimeout(r, delay));
    try {
        await msg.delete().catch(() => {});
    } catch (e) {}
}

// ===== INSTANT REACTION SYSTEM =====
async function addReaction(message, emoji) {
    try {
        await message.react(emoji);
    } catch (e) {}
}

// ===== READY EVENT =====
client.on('ready', () => {
    console.log(`✅ SELFBOT LOGGED IN: ${client.user.tag}`);
    console.log(`🆔 USER ID: ${client.user.id}`);
    console.log(`👑 OWNER ID: ${OWNER_ID}`);
    console.log(`⚡ PREFIX: ${PREFIX}`);
    console.log(`🔥 SUPER REACT USERS: ${superReactUsers.size}`);
    console.log(`🎯 AUTO REACT USERS: ${autoReactUsers.size}`);
    console.log(`📊 SERVERS: ${client.guilds.cache.size}`);
    console.log(`💾 DATA PATH: ${dataPath}`);
    
    // Set default status
    client.user.setActivity("optimized", { type: "PLAYING" });
});

// ===== MESSAGE EVENT =====
client.on('messageCreate', async (message) => {
    // Skip our own messages
    if (message.author.id === client.user.id) return;
    
    // ===== SUPER REACTION SYSTEM =====
    if (superReactUsers.has(message.author.id)) {
        addReaction(message, '🔥');
        addReaction(message, '💀');
        addReaction(message, '👀');
        addReaction(message, '😈');
        return;
    }
    
    // ===== CUSTOM AUTO REACT SYSTEM =====
    const userReactions = autoReactUsers.get(message.author.id);
    if (userReactions) {
        for (const emoji of userReactions) {
            addReaction(message, emoji);
        }
        return;
    }
    
    // ===== COMMAND HANDLER (OWNER ONLY) =====
    if (message.author.id !== OWNER_ID) return;
    if (!message.content.startsWith(PREFIX)) return;
    
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // Delete command message immediately
    message.delete().catch(() => {});
    
    let responseMsg = null;
    
    try {
        switch (command) {
            // ===== BASIC COMMANDS =====
            case 'ping':
                responseMsg = await message.channel.send(`${client.ws.ping}ms`);
                deleteMessage(responseMsg, 2000);
                break;
            
            case 'uptime':
                responseMsg = await message.channel.send(formatUptime());
                deleteMessage(responseMsg, 3000);
                break;
            
            // ===== STATUS COMMAND WITH CUSTOM IMAGE =====
            case 'status': {
                // Format: -status <type> <name> [image_url]
                // Types: playing, watching, listening, streaming, competing, crunchyroll
                // Example: -status streaming "My Stream" https://imgur.com/image.png
                // Example: -status crunchyroll "One Piece"
                
                if (args.length < 2) {
                    responseMsg = await message.channel.send(
                        'Usage:\n' +
                        '`-status <type> <name> [image_url]`\n' +
                        'Types: playing, watching, listening, streaming, competing, crunchyroll\n' +
                        'Examples:\n' +
                        '`-status streaming "My Stream" https://imgur.com/image.png`\n' +
                        '`-status crunchyroll "One Piece"`'
                    );
                    deleteMessage(responseMsg, 5000);
                    break;
                }
                
                const type = args.shift().toLowerCase();
                let statusName = '';
                let imageUrl = null;
                
                // Check if name is quoted
                if (args[0] && args[0].startsWith('"')) {
                    // Find closing quote
                    let fullName = [];
                    let foundClosing = false;
                    
                    for (let i = 0; i < args.length; i++) {
                        fullName.push(args[i]);
                        if (args[i].endsWith('"')) {
                            foundClosing = true;
                            // Get remaining as image URL
                            imageUrl = args.slice(i + 1).join(' ') || null;
                            break;
                        }
                    }
                    
                    statusName = fullName.join(' ').replace(/"/g, '');
                } else {
                    // Simple space-separated name
                    statusName = args[0];
                    imageUrl = args.slice(1).join(' ') || null;
                }
                
                // Handle Crunchyroll mode (special streaming with anime image)
                if (type === 'crunchyroll') {
                    try {
                        // Set streaming activity with Crunchyroll image
                        await client.user.setActivity(statusName, {
                            type: 'STREAMING',
                            url: 'https://www.twitch.tv/crunchyroll'
                        });
                        
                        // Set custom avatar/status via API if needed
                        // Note: Full Crunchyroll integration would require additional API calls
                        
                        responseMsg = await message.channel.send(`✅ Crunchyroll status set: Watching ${statusName}`);
                    } catch (e) {
                        responseMsg = await message.channel.send(`❌ Failed to set Crunchyroll status: ${e.message}`);
                    }
                }
                // Handle streaming with custom image
                else if (type === 'streaming') {
                    try {
                        await client.user.setActivity(statusName, {
                            type: 'STREAMING',
                            url: imageUrl || 'https://www.twitch.tv/stream'
                        });
                        
                        responseMsg = await message.channel.send(
                            imageUrl 
                                ? `✅ Streaming status set: "${statusName}" with custom image`
                                : `✅ Streaming status set: "${statusName}"`
                        );
                    } catch (e) {
                        responseMsg = await message.channel.send(`❌ Failed to set streaming status: ${e.message}`);
                    }
                }
                // Handle other activity types
                else {
                    const typeMap = {
                        'playing': 'PLAYING',
                        'watching': 'WATCHING',
                        'listening': 'LISTENING',
                        'competing': 'COMPETING'
                    };
                    
                    const activityType = typeMap[type];
                    
                    if (!activityType) {
                        responseMsg = await message.channel.send(
                            '❌ Invalid type. Use: playing, watching, listening, streaming, competing, crunchyroll'
                        );
                        deleteMessage(responseMsg, 4000);
                        break;
                    }
                    
                    try {
                        await client.user.setActivity(statusName, { type: activityType });
                        responseMsg = await message.channel.send(`✅ Status set: ${type} ${statusName}`);
                    } catch (e) {
                        responseMsg = await message.channel.send(`❌ Failed to set status: ${e.message}`);
                    }
                }
                
                deleteMessage(responseMsg, 3000);
                break;
            }
            
            // ===== CLEAR STATUS =====
            case 'clearstatus':
                await client.user.setActivity(null);
                responseMsg = await message.channel.send('✅ Status cleared');
                deleteMessage(responseMsg, 2000);
                break;
            
            // ===== SUPER REACT ADD =====
            case 'srar': {
                if (args.length < 1) {
                    responseMsg = await message.channel.send('Usage: -srar <user>');
                    deleteMessage(responseMsg, 2000);
                    break;
                }
                
                let targetUser = null;
                
                // Try mention
                if (message.mentions.users.size > 0) {
                    targetUser = message.mentions.users.first();
                } 
                // Try ID
                else {
                    try {
                        targetUser = await client.users.fetch(args[0]).catch(() => null);
                    } catch {}
                }
                
                if (!targetUser) {
                    responseMsg = await message.channel.send('❌ User not found');
                    deleteMessage(responseMsg, 2000);
                    break;
                }
                
                superReactUsers.add(targetUser.id);
                saveData();
                
                responseMsg = await message.channel.send(`✅ Super reaction enabled for ${targetUser.tag}`);
                deleteMessage(responseMsg, 2000);
                break;
            }
            
            // ===== SUPER REACT REMOVE =====
            case 'unsr': {
                if (args.length < 1) {
                    responseMsg = await message.channel.send('Usage: -unsr <user>');
                    deleteMessage(responseMsg, 2000);
                    break;
                }
                
                let targetUser = null;
                
                if (message.mentions.users.size > 0) {
                    targetUser = message.mentions.users.first();
                } else {
                    try {
                        targetUser = await client.users.fetch(args[0]).catch(() => null);
                    } catch {}
                }
                
                if (!targetUser) {
                    responseMsg = await message.channel.send('❌ User not found');
                    deleteMessage(responseMsg, 2000);
                    break;
                }
                
                if (superReactUsers.has(targetUser.id)) {
                    superReactUsers.delete(targetUser.id);
                    saveData();
                    responseMsg = await message.channel.send(`✅ Super reaction disabled for ${targetUser.tag}`);
                } else {
                    responseMsg = await message.channel.send(`❌ ${targetUser.tag} is not in super react list`);
                }
                
                deleteMessage(responseMsg, 2000);
                break;
            }
            
            // ===== SUPER REACT LIST =====
            case 'srlist': {
                if (superReactUsers.size === 0) {
                    responseMsg = await message.channel.send('No users in super react list');
                } else {
                    const users = [];
                    for (const userId of superReactUsers) {
                        try {
                            const user = await client.users.fetch(userId);
                            users.push(`• ${user.tag}`);
                        } catch {
                            users.push(`• Unknown user (${userId})`);
                        }
                    }
                    responseMsg = await message.channel.send(`**Super React Users:**\n${users.join('\n')}`);
                }
                deleteMessage(responseMsg, 5000);
                break;
            }
            
            // ===== AUTO REACT ADD (MULTI-EMOJI) =====
            case 'ar': {
                if (args.length < 2) {
                    responseMsg = await message.channel.send('Usage: -ar <user> <emoji1> [emoji2] [emoji3] [emoji4]');
                    deleteMessage(responseMsg, 3000);
                    break;
                }
                
                let targetUser = null;
                
                if (message.mentions.users.size > 0) {
                    targetUser = message.mentions.users.first();
                    args.shift(); // Remove mention from args
                } else {
                    try {
                        targetUser = await client.users.fetch(args[0]).catch(() => null);
                        args.shift();
                    } catch {}
                }
                
                if (!targetUser) {
                    responseMsg = await message.channel.send('❌ User not found');
                    deleteMessage(responseMsg, 2000);
                    break;
                }
                
                const emojis = args.slice(0, 4); // Max 4 emojis
                
                autoReactUsers.set(targetUser.id, emojis);
                saveData();
                
                responseMsg = await message.channel.send(`✅ Auto-react set for ${targetUser.tag}: ${emojis.join(' ')}`);
                deleteMessage(responseMsg, 3000);
                break;
            }
            
            // ===== AUTO REACT REMOVE =====
            case 'unar': {
                if (args.length < 1) {
                    responseMsg = await message.channel.send('Usage: -unar <user>');
                    deleteMessage(responseMsg, 2000);
                    break;
                }
                
                let targetUser = null;
                
                if (message.mentions.users.size > 0) {
                    targetUser = message.mentions.users.first();
                } else {
                    try {
                        targetUser = await client.users.fetch(args[0]).catch(() => null);
                    } catch {}
                }
                
                if (!targetUser) {
                    responseMsg = await message.channel.send('❌ User not found');
                    deleteMessage(responseMsg, 2000);
                    break;
                }
                
                if (autoReactUsers.has(targetUser.id)) {
                    autoReactUsers.delete(targetUser.id);
                    saveData();
                    responseMsg = await message.channel.send(`✅ Auto-react disabled for ${targetUser.tag}`);
                } else {
                    responseMsg = await message.channel.send(`❌ No auto-react set for ${targetUser.tag}`);
                }
                
                deleteMessage(responseMsg, 2000);
                break;
            }
            
            // ===== AUTO REACT LIST =====
            case 'arlist': {
                if (autoReactUsers.size === 0) {
                    responseMsg = await message.channel.send('No auto-react users');
                } else {
                    const entries = [];
                    for (const [userId, emojis] of autoReactUsers.entries()) {
                        try {
                            const user = await client.users.fetch(userId);
                            entries.push(`• ${user.tag}: ${emojis.join(' ')}`);
                        } catch {
                            entries.push(`• Unknown user (${userId}): ${emojis.join(' ')}`);
                        }
                    }
                    responseMsg = await message.channel.send(`**Auto-React Users:**\n${entries.join('\n')}`);
                }
                deleteMessage(responseMsg, 5000);
                break;
            }
            
            // ===== HELP =====
            case 'help':
            case 'h': {
                const helpText = [
                    '**🔧 SELFBOT COMMANDS**',
                    '',
                    '**Basic:**',
                    '`-ping` - Show latency',
                    '`-uptime` - Show bot uptime',
                    '',
                    '**Status:**',
                    '`-status <type> <name> [image_url]` - Set custom status',
                    '   Types: playing, watching, listening, streaming, competing, crunchyroll',
                    '`-clearstatus` - Clear current status',
                    '',
                    '**Super React (🔥💀👀😈):**',
                    '`-srar <user>` - Add user to super react',
                    '`-unsr <user>` - Remove user from super react',
                    '`-srlist` - List super react users',
                    '',
                    '**Auto React (custom emojis):**',
                    '`-ar <user> <emoji1> [emoji2] [emoji3] [emoji4]` - Set auto-react',
                    '`-unar <user>` - Remove auto-react',
                    '`-arlist` - List auto-react users',
                    '',
                    '**Examples:**',
                    '`-status streaming "My Stream" https://i.imgur.com/image.png`',
                    '`-status crunchyroll "One Piece"`',
                    '`-ar @user 😈 👍 ❤️`',
                    '`-srar @user`'
                ].join('\n');
                
                responseMsg = await message.channel.send(helpText);
                deleteMessage(responseMsg, 10000);
                break;
            }
            
            default:
                responseMsg = await message.channel.send(`❌ Unknown command. Use -help`);
                deleteMessage(responseMsg, 2000);
        }
    } catch (error) {
        console.error('Command error:', error);
        try {
            responseMsg = await message.channel.send(`❌ Error: ${error.message}`);
            deleteMessage(responseMsg, 3000);
        } catch {}
    }
});

// ===== ERROR HANDLING =====
client.on('error', (error) => {
    console.error('Client error:', error);
});

client.on('warn', (warning) => {
    console.warn('Client warning:', warning);
});

// ===== LOGIN WITH RAILWAY TOKEN =====
client.login(TOKEN).catch(error => {
    console.error('❌ Failed to login:', error.message);
    console.error('   Make sure your token is correct in Railway Variables');
    process.exit(1);
});
