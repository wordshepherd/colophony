from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.export_csr_response_200_native_submissions_item_status_history_item_from_type_0 import (
    ExportCsrResponse200NativeSubmissionsItemStatusHistoryItemFromType0,
)
from ..models.export_csr_response_200_native_submissions_item_status_history_item_to import (
    ExportCsrResponse200NativeSubmissionsItemStatusHistoryItemTo,
)

T = TypeVar("T", bound="ExportCsrResponse200NativeSubmissionsItemStatusHistoryItem")


@_attrs_define
class ExportCsrResponse200NativeSubmissionsItemStatusHistoryItem:
    """
    Attributes:
        from_ (ExportCsrResponse200NativeSubmissionsItemStatusHistoryItemFromType0 | None):
        to (ExportCsrResponse200NativeSubmissionsItemStatusHistoryItemTo): Harmonized submission status across systems
        changed_at (datetime.datetime):
        comment (None | str):
    """

    from_: ExportCsrResponse200NativeSubmissionsItemStatusHistoryItemFromType0 | None
    to: ExportCsrResponse200NativeSubmissionsItemStatusHistoryItemTo
    changed_at: datetime.datetime
    comment: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from_: None | str
        if isinstance(self.from_, ExportCsrResponse200NativeSubmissionsItemStatusHistoryItemFromType0):
            from_ = self.from_.value
        else:
            from_ = self.from_

        to = self.to.value

        changed_at = self.changed_at.isoformat()

        comment: None | str
        comment = self.comment

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "from": from_,
                "to": to,
                "changedAt": changed_at,
                "comment": comment,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)

        def _parse_from_(data: object) -> ExportCsrResponse200NativeSubmissionsItemStatusHistoryItemFromType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                from_type_0 = ExportCsrResponse200NativeSubmissionsItemStatusHistoryItemFromType0(data)

                return from_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ExportCsrResponse200NativeSubmissionsItemStatusHistoryItemFromType0 | None, data)

        from_ = _parse_from_(d.pop("from"))

        to = ExportCsrResponse200NativeSubmissionsItemStatusHistoryItemTo(d.pop("to"))

        changed_at = datetime.datetime.fromisoformat(d.pop("changedAt"))

        def _parse_comment(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        comment = _parse_comment(d.pop("comment"))

        export_csr_response_200_native_submissions_item_status_history_item = cls(
            from_=from_,
            to=to,
            changed_at=changed_at,
            comment=comment,
        )

        export_csr_response_200_native_submissions_item_status_history_item.additional_properties = d
        return export_csr_response_200_native_submissions_item_status_history_item

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
