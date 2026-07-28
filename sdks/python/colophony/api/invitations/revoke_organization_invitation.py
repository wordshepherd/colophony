from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.revoke_organization_invitation_response_200 import RevokeOrganizationInvitationResponse200
from ...types import Response


def _get_kwargs(
    org_id: UUID,
    invitation_id: UUID,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/organizations/{org_id}/invitations/{invitation_id}".format(
            org_id=quote(str(org_id), safe=""),
            invitation_id=quote(str(invitation_id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> RevokeOrganizationInvitationResponse200 | None:
    if response.status_code == 200:
        response_200 = RevokeOrganizationInvitationResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[RevokeOrganizationInvitationResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    org_id: UUID,
    invitation_id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> Response[RevokeOrganizationInvitationResponse200]:
    """Revoke an invitation

     Revoke a pending invitation. Requires ADMIN role.

    Args:
        org_id (UUID):
        invitation_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[RevokeOrganizationInvitationResponse200]
    """

    kwargs = _get_kwargs(
        org_id=org_id,
        invitation_id=invitation_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    org_id: UUID,
    invitation_id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> RevokeOrganizationInvitationResponse200 | None:
    """Revoke an invitation

     Revoke a pending invitation. Requires ADMIN role.

    Args:
        org_id (UUID):
        invitation_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        RevokeOrganizationInvitationResponse200
    """

    return sync_detailed(
        org_id=org_id,
        invitation_id=invitation_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    org_id: UUID,
    invitation_id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> Response[RevokeOrganizationInvitationResponse200]:
    """Revoke an invitation

     Revoke a pending invitation. Requires ADMIN role.

    Args:
        org_id (UUID):
        invitation_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[RevokeOrganizationInvitationResponse200]
    """

    kwargs = _get_kwargs(
        org_id=org_id,
        invitation_id=invitation_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    org_id: UUID,
    invitation_id: UUID,
    *,
    client: AuthenticatedClient | Client,
) -> RevokeOrganizationInvitationResponse200 | None:
    """Revoke an invitation

     Revoke a pending invitation. Requires ADMIN role.

    Args:
        org_id (UUID):
        invitation_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        RevokeOrganizationInvitationResponse200
    """

    return (
        await asyncio_detailed(
            org_id=org_id,
            invitation_id=invitation_id,
            client=client,
        )
    ).parsed
