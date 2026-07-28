from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.batch_update_submission_status_body import BatchUpdateSubmissionStatusBody
from ...models.batch_update_submission_status_response_200 import BatchUpdateSubmissionStatusResponse200
from ...types import Response


def _get_kwargs(
    *,
    body: BatchUpdateSubmissionStatusBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/submissions/batch/status",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> BatchUpdateSubmissionStatusResponse200 | None:
    if response.status_code == 200:
        response_200 = BatchUpdateSubmissionStatusResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[BatchUpdateSubmissionStatusResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: BatchUpdateSubmissionStatusBody,
) -> Response[BatchUpdateSubmissionStatusResponse200]:
    """Batch update submission status

     Transition multiple submissions to a new status in one request. Requires EDITOR or ADMIN role.

    Args:
        body (BatchUpdateSubmissionStatusBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[BatchUpdateSubmissionStatusResponse200]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    body: BatchUpdateSubmissionStatusBody,
) -> BatchUpdateSubmissionStatusResponse200 | None:
    """Batch update submission status

     Transition multiple submissions to a new status in one request. Requires EDITOR or ADMIN role.

    Args:
        body (BatchUpdateSubmissionStatusBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        BatchUpdateSubmissionStatusResponse200
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: BatchUpdateSubmissionStatusBody,
) -> Response[BatchUpdateSubmissionStatusResponse200]:
    """Batch update submission status

     Transition multiple submissions to a new status in one request. Requires EDITOR or ADMIN role.

    Args:
        body (BatchUpdateSubmissionStatusBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[BatchUpdateSubmissionStatusResponse200]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: BatchUpdateSubmissionStatusBody,
) -> BatchUpdateSubmissionStatusResponse200 | None:
    """Batch update submission status

     Transition multiple submissions to a new status in one request. Requires EDITOR or ADMIN role.

    Args:
        body (BatchUpdateSubmissionStatusBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        BatchUpdateSubmissionStatusResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
