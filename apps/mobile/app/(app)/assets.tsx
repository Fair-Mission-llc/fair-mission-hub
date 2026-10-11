// Council Assets (Sprint 7F Extension 2): the phone's read-only inspection panel for the council's property. Each asset
// shows its photo - the Google Drive file filed under Fraternal Enterprise Suite / Assets / <asset name>, drawn through
// Drive's thumbnail service - with its status, serial number and where it is kept. Opened from Home by the members
// cleared for the inventory (canAttachAssetPhoto: the asset managers, the Deputy Grand Knight and the Trustees); the
// driver checks assertMayAttachAssetPhoto. Photos are added on the web portal's asset form.
import { Image, View } from 'react-native';
import { driveThumbnailUrl, isDriveFileId, type CouncilAssetsInventory, type CouncilAssetStatus } from '@kofc/shared';
import { NavStrip } from '@/components/NavStrip';
import { AppText, Card, EmptyState, Loading, Notice, Screen } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { useTheme } from '@/lib/layout-mode';
import { useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

const STATUS_LABELS: Record<CouncilAssetStatus, string> = { ACTIVE: 'Active', DISPOSED: 'Disposed', LOST: 'Lost' };
const PHOTO_SIZE = 96;

function AssetCard({ asset }: { asset: CouncilAssetsInventory }) {
  const { color, space, radius, border } = useTheme();
  const photo = isDriveFileId(asset.photo_url) ? driveThumbnailUrl(asset.photo_url!, 400) : null;
  return (
    <Card accent={asset.current_status === 'ACTIVE' ? color.navy : color.gold}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            accessibilityLabel={`Photo of ${asset.asset_name}`}
            style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: radius.sm, borderWidth: border(2), borderColor: color.navy }}
          />
        ) : (
          <View
            accessibilityLabel="No photo"
            style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: radius.sm, borderWidth: border(2), borderStyle: 'dashed', borderColor: color.navy, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppText variant="small" tone="muted">
              No photo
            </AppText>
          </View>
        )}
        <View style={{ flex: 1, gap: space.xs }}>
          <AppText variant="title">{asset.asset_name}</AppText>
          <AppText variant="small">{STATUS_LABELS[asset.current_status]}</AppText>
          <AppText variant="small" tone="muted">
            Serial: {asset.serial_number ?? '—'}
          </AppText>
          <AppText variant="small" tone="muted">
            Kept at: {asset.storage_location ?? '—'}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

export default function CouncilAssetsScreen() {
  const user = useUser();
  const state = useLoad(() => db.expenses.listAssetsInventory(user.memberId, user.councilId), [user.memberId, user.councilId]);
  return (
    <Screen refreshing={state.refreshing} onRefresh={() => void state.reload()}>
      <NavStrip closeLabel="Close council assets" />
      <AppText variant="heading" accessibilityRole="header">
        Council Assets
      </AppText>
      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {!state.data && state.loading ? <Loading /> : null}
      {state.data && state.data.length === 0 ? <EmptyState message="The council has no assets yet." /> : null}
      {(state.data ?? []).map((a) => (
        <AssetCard key={a.id} asset={a} />
      ))}
      <AppText variant="small" tone="muted">
        Photos are kept in the council Google Drive. Add or change a photo on the web portal.
      </AppText>
    </Screen>
  );
}
