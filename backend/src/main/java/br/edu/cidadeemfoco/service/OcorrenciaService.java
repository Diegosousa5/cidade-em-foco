package br.edu.cidadeemfoco.service;

import br.edu.cidadeemfoco.dto.CriarOcorrenciaRequest;
import br.edu.cidadeemfoco.dto.OcorrenciaResponse;
import br.edu.cidadeemfoco.model.Ocorrencia;
import br.edu.cidadeemfoco.repository.OcorrenciaRepository;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
public class OcorrenciaService {

    private static final int SRID_WGS84 = 4326;
    private static final GeometryFactory GEOMETRY_FACTORY =
        new GeometryFactory(new PrecisionModel(), SRID_WGS84);

    private final OcorrenciaRepository ocorrenciaRepository;

    public OcorrenciaService(OcorrenciaRepository ocorrenciaRepository) {
        this.ocorrenciaRepository = ocorrenciaRepository;
    }

    @Transactional
    public OcorrenciaResponse cadastrar(CriarOcorrenciaRequest request) {
        Ocorrencia ocorrencia = new Ocorrencia(
            request.titulo(),
            request.descricao(),
            request.categoria(),
            request.endereco(),
            Instant.now(),
            criarPonto(request.latitude(), request.longitude())
        );

        return paraResponse(ocorrenciaRepository.save(ocorrencia));
    }

    @Transactional
    public OcorrenciaResponse atualizar(Long id, CriarOcorrenciaRequest request) {
        Ocorrencia ocorrencia = buscarPorId(id);
        ocorrencia.setTitulo(request.titulo());
        ocorrencia.setDescricao(request.descricao());
        ocorrencia.setCategoria(request.categoria());
        ocorrencia.setEndereco(request.endereco());
        ocorrencia.setLocalizacao(criarPonto(request.latitude(), request.longitude()));

        return paraResponse(ocorrenciaRepository.save(ocorrencia));
    }

    @Transactional
    public void excluir(Long id) {
        ocorrenciaRepository.delete(buscarPorId(id));
    }

    @Transactional(readOnly = true)
    public List<OcorrenciaResponse> listarTodas() {
        return ocorrenciaRepository.findAll(Sort.by(Sort.Direction.DESC, "dataCriacao"))
            .stream()
            .map(this::paraResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<OcorrenciaResponse> listarPorArea(
        double minLatitude,
        double minLongitude,
        double maxLatitude,
        double maxLongitude
    ) {
        validarLimitesArea(minLatitude, minLongitude, maxLatitude, maxLongitude);
        return ocorrenciaRepository.findWithinBoundingBox(
                minLatitude,
                minLongitude,
                maxLatitude,
                maxLongitude
            )
            .stream()
            .map(this::paraResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<OcorrenciaResponse> listarProximas(
        double latitude,
        double longitude,
        double raioMetros
    ) {
        validarCoordenadas(latitude, longitude);
        if (!Double.isFinite(raioMetros) || raioMetros <= 0 || raioMetros > 20_000_000) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "O raio deve ser maior que zero e não pode exceder 20.000.000 metros"
            );
        }

        return ocorrenciaRepository.findWithinRadius(latitude, longitude, raioMetros)
            .stream()
            .map(this::paraResponse)
            .toList();
    }

    private void validarCoordenadas(double latitude, double longitude) {
        if (!Double.isFinite(latitude) || latitude < -90 || latitude > 90) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Latitude inválida");
        }
        if (!Double.isFinite(longitude) || longitude < -180 || longitude > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Longitude inválida");
        }
    }

    private void validarLimitesArea(
        double minLatitude,
        double minLongitude,
        double maxLatitude,
        double maxLongitude
    ) {
        if (!Double.isFinite(minLatitude) || !Double.isFinite(maxLatitude)
            || minLatitude < -90 || maxLatitude > 90 || minLatitude > maxLatitude) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Limites de latitude inválidos");
        }
        if (!Double.isFinite(minLongitude) || !Double.isFinite(maxLongitude)
            || minLongitude < -180 || maxLongitude > 180 || minLongitude > maxLongitude) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Limites de longitude inválidos");
        }
    }

    private Ocorrencia buscarPorId(Long id) {
        return ocorrenciaRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Ocorrência não encontrada"
            ));
    }

    private Point criarPonto(double latitude, double longitude) {
        return GEOMETRY_FACTORY.createPoint(new Coordinate(longitude, latitude));
    }

    private OcorrenciaResponse paraResponse(Ocorrencia ocorrencia) {
        Point localizacao = ocorrencia.getLocalizacao();
        return new OcorrenciaResponse(
            ocorrencia.getId(),
            ocorrencia.getTitulo(),
            ocorrencia.getDescricao(),
            ocorrencia.getCategoria(),
            ocorrencia.getEndereco(),
            ocorrencia.getStatus(),
            ocorrencia.getDataCriacao(),
            localizacao.getY(),
            localizacao.getX()
        );
    }
}
