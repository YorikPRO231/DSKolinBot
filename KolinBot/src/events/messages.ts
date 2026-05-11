import { Client, EmbedBuilder, Message } from "discord.js";
import { PUNISHMENT_ADMINS_CHANNEL_ID } from "../utils/config";

const COMMAND_PATTERNS = {
    TIME_COMMANDS:  ['offprison', 'offban', 'offmute', 'offvehicle_ban', 'offweapon_ban', 'sban', 'offsban'],
    SIMPLE_COMMANDS: ['offwarn', 'iban', 'unban', 'unwarn', 'offunjail', 'offforce_rename', 'offforce_gender', 'offuninvite', 'offiban', 'offsiban', 'hardban', 'uninvite'],
    ONLINE_ONLY: ['hardban', 'ban', 'kick', 'prison', 'mute', 'unmute', 'unjail', 'mute_report', 'unmute_report', 'iban', 'vehicle_ban', 'weapon_ban', 'uninvite', 'sban']
} as const;

const TIME_PATTERN = new RegExp(`^(${COMMAND_PATTERNS.TIME_COMMANDS.join('|')}) (\\d+) (\\d+) (.+)$`);
const SIMPLE_PATTERN = new RegExp(`^(${COMMAND_PATTERNS.SIMPLE_COMMANDS.join('|')}) (\\d+) (.+)$`);
const ONLINE_ONLY_PATTERN = new RegExp(`^(${COMMAND_PATTERNS.ONLINE_ONLY.join('|')})\\b`);

interface ValidationResult {
    isValid: boolean;
    index: number;
    command: string;
}

interface OnlineOnlyResult {
    index: number;
    command: string;
    offlineVersion: string;
}

export async function punishChecker(client: Client, message: Message): Promise<void> {
    if (!message.inGuild() || 
        message.channelId !== PUNISHMENT_ADMINS_CHANNEL_ID || 
        message.author.bot) {
        return;
    }

    const commands = message.content.split('\n').map(cmd => cmd.trim()).filter(Boolean);
    
    if (commands.length === 0) {
        return;
    }

    const invalidCommands = validateCommands(commands);
    const onlineOnlyCommands = checkOnlineOnly(commands);

    if (invalidCommands.length > 0 || onlineOnlyCommands.length > 0) {
        await sendErrorEmbed(message, invalidCommands, onlineOnlyCommands);
    }
}

function validateCommands(commands: string[]): ValidationResult[] {
    return commands
        .map((cmd, index) => ({
            isValid: TIME_PATTERN.test(cmd) || SIMPLE_PATTERN.test(cmd),
            index: index + 1, 
            command: cmd
        }))
        .filter(result => !result.isValid);
}

function checkOnlineOnly(commands: string[]): OnlineOnlyResult[] {
    return commands
        .map((cmd, index) => {
            const match = cmd.match(ONLINE_ONLY_PATTERN);
            if (!match) return null;
            
            const commandName = match[1];
            const args = cmd.slice(commandName.length); 
            
            const offlineVersion = commandName === 'hardban' 
                ? 'hardban (только онлайн, off версии нет)'
                : `off${commandName}${args}`;
            
            return {
                index: index + 1,
                command: cmd,
                offlineVersion
            };
        })
        .filter((result): result is OnlineOnlyResult => result !== null);
}

async function sendErrorEmbed(
    message: Message, 
    invalidCommands: ValidationResult[], 
    onlineOnlyCommands: OnlineOnlyResult[]
): Promise<void> {
    const embed = new EmbedBuilder()
        .setAuthor({
            name: 'Admin Checker',
            iconURL: message.guild?.iconURL() ?? undefined
        })
        .setTitle('GTA 5 RP | Blackberry')
        .setColor(0x7600a1)
        .setFooter({
            text: message.author.tag,
            iconURL: message.author.displayAvatarURL()
        })
        .setTimestamp()
        .setDescription(formatErrorMessage(invalidCommands, onlineOnlyCommands));

    try {
        await message.author.send({ embeds: [embed] });
        await message.react('❌');
    } catch (error) {
        console.error(`Не удалось отправить DM пользователю ${message.author.tag}:`, error);
        await message.react('❌');
    }
}

function formatErrorMessage(invalidCommands: ValidationResult[], onlineOnlyCommands: OnlineOnlyResult[]): string {
    const parts: string[] = [];

    if (invalidCommands.length > 0) {
        const commandList = invalidCommands
            .map(({ index, command }) => `${index}. ${command}`)
            .join('\n');

        parts.push(
            'Следующие команды не были распознаны. Перепроверьте написание.',
            '```',
            commandList,
            '```'
        );
    }

    if (onlineOnlyCommands.length > 0) {
        const commandList = onlineOnlyCommands
            .map(({ index, command, offlineVersion }) => 
                `${index}. ${command} → ${offlineVersion}`
            )
            .join('\n');

        parts.push(
            'Эти команды отправьте в чат администрации, либо используйте off версию:',
            '```',
            commandList,
            '```'
        );
    }

    return parts.join('\n');
}

export { TIME_PATTERN, SIMPLE_PATTERN, validateCommands };