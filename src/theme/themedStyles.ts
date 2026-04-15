/**
 * Shared Themed Styles
 * Provides consistent styling patterns across all screens
 * Based on the FeedScreen design language
 *
 * Font usage in dark mode:
 * - NothingYouCouldDo: Main screen headers
 * - JuliusSansOne: Titles, names, labels, dates
 * - Aboreto: Accent labels, tags, section headers
 * - KleeOne: Body text, descriptions, notifications, chats
 */
import { typography, spacing, borderRadius, shadows, colors as legacyColors } from './designSystem';
import { ThemeColors } from './ThemeContext';

// Font constants for easy reference
// Dark mode fonts
const FONT_HEADER = 'NothingYouCouldDo_400Regular';
const FONT_TITLE = 'JuliusSansOne_400Regular';
const FONT_ACCENT = 'Aboreto_400Regular';
const FONT_BODY = 'KleeOne_400Regular';
const FONT_BODY_BOLD = 'KleeOne_600SemiBold';
// Light mode fonts - rustic, rugged, professional
const FONT_LIGHT_HEADER = 'PlayfairDisplay_700Bold';
const FONT_LIGHT_BODY = 'Sora_400Regular';
const FONT_LIGHT_BODY_MEDIUM = 'Sora_500Medium';
const FONT_LIGHT_ACCENT = 'Lora_600SemiBold';
// Legacy aliases for backwards compat
const FONT_INTER = FONT_LIGHT_BODY;
const FONT_INTER_MEDIUM = FONT_LIGHT_BODY_MEDIUM;
const FONT_INTER_SEMIBOLD = FONT_LIGHT_HEADER;

/**
 * Generate dynamic styles based on current theme
 */
export function getThemedStyles(colors: ThemeColors, isNewTheme: boolean) {
  return {
    // ==================
    // CONTAINERS
    // ==================
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    surface: {
      backgroundColor: isNewTheme ? colors.surface : legacyColors.white,
      borderWidth: isNewTheme ? 1 : 0,
      borderColor: colors.border,
    },

    surfaceAlt: {
      backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary,
      borderWidth: isNewTheme ? 1 : 0,
      borderColor: colors.border,
    },

    // ==================
    // HEADER STYLES
    // ==================
    header: {
      backgroundColor: colors.surface,
      paddingTop: 50,
      paddingBottom: spacing.base,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: isNewTheme ? 1 : 0,
      borderBottomColor: colors.border,
    },

    headerSubtitle: {
      fontSize: typography.fontSize.sm,
      color: colors.textSecondary,
      fontWeight: typography.fontWeight.medium as '500',
      marginBottom: spacing.xs,
      fontFamily: isNewTheme ? FONT_ACCENT : FONT_INTER_MEDIUM,
      textTransform: isNewTheme ? 'uppercase' as const : 'none' as const,
      letterSpacing: isNewTheme ? 1 : 0,
    },

    headerTitle: {
      fontSize: typography.fontSize['3xl'],
      fontWeight: typography.fontWeight.bold as '700',
      color: isNewTheme ? colors.accentGreen : colors.textPrimary,
      fontFamily: isNewTheme ? FONT_HEADER : FONT_INTER_SEMIBOLD,
    },

    // ==================
    // CARD STYLES
    // ==================
    card: {
      backgroundColor: isNewTheme ? colors.surface : legacyColors.white,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.base,
      ...shadows.base,
      borderWidth: 1,
      borderColor: isNewTheme ? colors.border : legacyColors.borderLight,
    },

    cardTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold as '600',
      color: colors.textPrimary,
      lineHeight: typography.fontSize.lg * typography.lineHeight.tight,
      fontFamily: isNewTheme ? FONT_TITLE : FONT_INTER_SEMIBOLD,
    },

    cardDescription: {
      fontSize: typography.fontSize.base,
      color: colors.textSecondary,
      lineHeight: typography.fontSize.base * typography.lineHeight.normal,
      fontFamily: isNewTheme ? FONT_BODY : FONT_INTER,
    },

    cardSmallText: {
      fontSize: typography.fontSize.sm,
      color: colors.textSecondary,
      fontFamily: isNewTheme ? FONT_BODY : FONT_INTER,
    },

    // ==================
    // TEXT STYLES
    // ==================
    textPrimary: {
      color: colors.textPrimary,
      fontFamily: isNewTheme ? FONT_BODY : FONT_INTER,
    },

    textSecondary: {
      color: colors.textSecondary,
      fontFamily: isNewTheme ? FONT_BODY : FONT_INTER,
    },

    textTertiary: {
      color: colors.textTertiary,
      fontFamily: isNewTheme ? FONT_BODY : FONT_INTER,
    },

    textAccent: {
      color: isNewTheme ? colors.accentGreen : legacyColors.primary,
      fontFamily: isNewTheme ? FONT_ACCENT : FONT_INTER_MEDIUM,
      textTransform: isNewTheme ? 'uppercase' as const : 'none' as const,
      letterSpacing: isNewTheme ? 0.5 : 0,
    },

    bodyText: {
      fontSize: typography.fontSize.base,
      color: colors.textPrimary,
      lineHeight: typography.fontSize.base * typography.lineHeight.normal,
      fontFamily: isNewTheme ? FONT_BODY : FONT_INTER,
    },

    labelText: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium as '500',
      color: colors.textSecondary,
      fontFamily: isNewTheme ? FONT_TITLE : FONT_INTER_MEDIUM,
    },

    // ==================
    // INPUT STYLES
    // ==================
    input: {
      backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary,
      borderRadius: borderRadius.base,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.md,
      borderWidth: isNewTheme ? 1 : 0,
      borderColor: colors.border,
    },

    inputText: {
      fontSize: typography.fontSize.base,
      color: colors.textPrimary,
      fontFamily: isNewTheme ? FONT_BODY : FONT_INTER,
    },

    searchContainer: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary,
      paddingHorizontal: spacing.base,
      borderRadius: borderRadius.base,
      height: 44,
      borderWidth: isNewTheme ? 1 : 0,
      borderColor: colors.border,
    },

    // ==================
    // BUTTON STYLES
    // ==================
    buttonPrimary: {
      backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },

    buttonPrimaryText: {
      color: isNewTheme ? colors.background : legacyColors.white,
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold as '600',
      fontFamily: isNewTheme ? FONT_TITLE : FONT_INTER_SEMIBOLD,
    },

    buttonSecondary: {
      backgroundColor: 'transparent',
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: isNewTheme ? colors.border : legacyColors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },

    buttonSecondaryText: {
      color: colors.textPrimary,
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium as '500',
      fontFamily: isNewTheme ? FONT_TITLE : FONT_INTER_MEDIUM,
    },

    // ==================
    // TAG/BADGE STYLES
    // ==================
    tag: {
      backgroundColor: isNewTheme ? 'rgba(168, 230, 163, 0.15)' : legacyColors.primaryLight,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: isNewTheme ? 1 : 0,
      borderColor: isNewTheme ? colors.accentGreenMuted : 'transparent',
    },

    tagText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium as '500',
      color: isNewTheme ? colors.accentGreen : legacyColors.primary,
      fontFamily: isNewTheme ? FONT_ACCENT : FONT_INTER_MEDIUM,
      textTransform: isNewTheme ? 'uppercase' as const : 'none' as const,
      letterSpacing: isNewTheme ? 0.5 : 0,
    },

    badge: {
      backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
    },

    badgeText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.bold as '700',
      color: isNewTheme ? colors.background : legacyColors.white,
      fontFamily: isNewTheme ? FONT_ACCENT : FONT_INTER_SEMIBOLD,
    },

    // ==================
    // LIST ITEM STYLES
    // ==================
    listItem: {
      backgroundColor: isNewTheme ? colors.surface : legacyColors.white,
      paddingVertical: spacing.base,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    listItemTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold as '600',
      color: colors.textPrimary,
      fontFamily: isNewTheme ? FONT_TITLE : FONT_INTER_SEMIBOLD,
    },

    listItemSubtitle: {
      fontSize: typography.fontSize.sm,
      color: colors.textSecondary,
      fontFamily: isNewTheme ? FONT_BODY : FONT_INTER,
    },

    // ==================
    // SECTION STYLES
    // ==================
    sectionHeader: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.bold as '700',
      color: colors.textSecondary,
      fontFamily: isNewTheme ? FONT_ACCENT : FONT_INTER_MEDIUM,
      textTransform: 'uppercase' as const,
      letterSpacing: isNewTheme ? 1 : 0.5,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary,
    },

    divider: {
      height: 1,
      backgroundColor: colors.border,
    },

    // ==================
    // MODAL STYLES
    // ==================
    modalOverlay: {
      flex: 1,
      backgroundColor: isNewTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end' as const,
    },

    modalContent: {
      backgroundColor: isNewTheme ? colors.surface : legacyColors.white,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingBottom: spacing['2xl'],
    },

    modalHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    modalTitle: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold as '700',
      color: colors.textPrimary,
      fontFamily: isNewTheme ? FONT_TITLE : FONT_INTER_SEMIBOLD,
    },

    // ==================
    // ICON CONTAINER
    // ==================
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.base,
      backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },

    iconContainerSmall: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.sm,
      backgroundColor: isNewTheme ? colors.surfaceAlt : legacyColors.backgroundSecondary,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },

    // ==================
    // EMPTY STATE
    // ==================
    emptyContainer: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: spacing['2xl'],
    },

    emptyText: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold as '600',
      color: colors.textPrimary,
      marginTop: spacing.lg,
      fontFamily: isNewTheme ? FONT_TITLE : FONT_INTER_SEMIBOLD,
    },

    emptySubtext: {
      fontSize: typography.fontSize.base,
      color: colors.textSecondary,
      marginTop: spacing.sm,
      textAlign: 'center' as const,
      fontFamily: isNewTheme ? FONT_BODY : FONT_INTER,
    },

    // ==================
    // AVATAR
    // ==================
    avatar: {
      backgroundColor: isNewTheme ? colors.accentGreen : legacyColors.primary,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },

    avatarText: {
      color: isNewTheme ? colors.background : legacyColors.white,
      fontWeight: typography.fontWeight.bold as '700',
    },

    // ==================
    // STATUS COLORS
    // ==================
    success: {
      color: colors.success,
    },

    warning: {
      color: colors.warning,
    },

    error: {
      color: colors.error,
    },

    // ==================
    // REFRESH CONTROL COLOR
    // ==================
    refreshColor: isNewTheme ? colors.accentGreen : legacyColors.primary,

    // ==================
    // ACCENT ICON COLOR
    // ==================
    accentIconColor: isNewTheme ? colors.accentGreen : legacyColors.primary,
  };
}

export type ThemedStyles = ReturnType<typeof getThemedStyles>;
